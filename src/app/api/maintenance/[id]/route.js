import { requireSession, tenantFilter, ok, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notify";
import MaintenanceRequest from "@/models/MaintenanceRequest";
import Vendor from "@/models/Vendor";

const STATUSES = ["open", "assigned", "in_progress", "resolved", "closed"];

// Assign / progress / resolve / close a work order (maintenance.assign), OR — for
// the resident who raised it — submit a satisfaction rating after resolution.
// Body: { status?, assignedVendorId?, resolutionNote?, slaHours?, satisfactionRating?, satisfactionComment? }
export async function PATCH(req, { params }) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const request = await MaintenanceRequest.findOne(tenantFilter(session, { _id: id }));
  if (!request) return bad("Request not found", 404);

  // Resident feedback path: the raiser rates resolution (no manage permission needed).
  const ratingOnly =
    b.satisfactionRating !== undefined &&
    b.status === undefined &&
    b.assignedVendorId === undefined &&
    b.resolutionNote === undefined;
  if (ratingOnly) {
    if (String(request.raisedById) !== String(session.uid))
      return bad("Only the resident who raised this can rate it", 403);
    if (!["resolved", "closed"].includes(request.status))
      return bad("You can rate once the request is resolved", 409);
    const rating = Number(b.satisfactionRating);
    if (!(rating >= 1 && rating <= 5)) return bad("rating must be 1–5");
    request.satisfactionRating = rating;
    request.satisfactionComment = b.satisfactionComment;
    await request.save();
    await audit(session, "maintenance.rate", `Rated ${request.code} ${rating}★`, {
      entity: "MaintenanceRequest",
      entityId: request._id,
    });
    return ok({ request });
  }

  // Management path.
  if (!hasPermission(session.permissions, "maintenance.assign"))
    return bad('Forbidden — missing permission "maintenance.assign"', 403);
  if (session.scopeBlocks?.length && request.blockCode && !session.scopeBlocks.includes(request.blockCode))
    return bad("This request is outside your assigned tower(s)", 403);

  if (b.assignedVendorId !== undefined) {
    if (b.assignedVendorId) {
      const vendor = await Vendor.findOne(tenantFilter(session, { _id: b.assignedVendorId })).lean();
      if (!vendor) return bad("Vendor not found", 404);
      request.assignedVendorId = vendor._id;
      request.assignedToName = vendor.name;
      request.assignedAt = new Date();
      if (request.status === "open") request.status = "assigned";
    } else {
      request.assignedVendorId = undefined;
      request.assignedToName = undefined;
    }
  }

  if (b.slaHours !== undefined) request.slaHours = Number(b.slaHours) || undefined;

  if (b.status && STATUSES.includes(b.status)) {
    request.status = b.status;
    if (b.status === "resolved") request.resolvedAt = new Date();
    if (b.status === "closed") request.closedAt = new Date();
    // SLA breach check on resolution/closure
    if (["resolved", "closed"].includes(b.status) && request.slaHours) {
      const elapsedH = (Date.now() - new Date(request.createdAt).getTime()) / 3600000;
      request.slaBreached = elapsedH > request.slaHours;
    }
  }
  if (b.resolutionNote !== undefined) request.resolutionNote = b.resolutionNote;

  await request.save();
  const closed = ["resolved", "closed"].includes(request.status);
  const action = closed ? "maintenance.close" : "maintenance.assign";
  await audit(session, action, `${closed ? "Resolved/closed" : "Updated"} ${request.code} (${request.status})${request.assignedToName ? ` → ${request.assignedToName}` : ""}`, {
    entity: "MaintenanceRequest",
    entityId: request._id,
  });
  // notify the resident of progress
  if (request.raisedById && String(request.raisedById) !== String(session.uid))
    await notifyUsers(session.societyId, [request.raisedById], {
      title: `${request.code} is now ${request.status.replace("_", " ")}`,
      body: request.title,
      kind: "maintenance",
      link: "/maintenance",
      entityId: request._id,
    });
  return ok({ request });
}
