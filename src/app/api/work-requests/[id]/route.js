import { requireSession, tenantFilter, ok, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notifyByPermission, notifyUsers } from "@/lib/notify";
import WorkRequest from "@/models/WorkRequest";

// Drive a request through the workflow. Body: { action, note, condition, remark }
// action: "approve" | "reject" | "complete"
export async function PATCH(req, { params }) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const action = b.action;

  const request = await WorkRequest.findOne(tenantFilter(session, { _id: id }));
  if (!request) return bad("Request not found", 404);
  if (session.scopeBlocks?.length && request.blockCode && !session.scopeBlocks.includes(request.blockCode))
    return bad("This request is outside your assigned tower(s)", 403);

  const push = (act, note) =>
    request.history.push({ actorId: session.uid, actorName: session.name, action: act, note });

  if (action === "approve") {
    if (request.status === "pending_l1") {
      if (!hasPermission(session.permissions, "requests.approve_l1"))
        return bad('Forbidden — missing "requests.approve_l1"', 403);
      if (b.remark) request.financeRemark = b.remark;
      request.status = request.levels >= 2 ? "pending_l2" : "approved";
      push("l1_approved", b.remark);
    } else if (request.status === "pending_l2") {
      if (!hasPermission(session.permissions, "requests.approve_l2"))
        return bad('Forbidden — missing "requests.approve_l2"', 403);
      if (b.condition) request.chairmanCondition = b.condition;
      request.status = "approved";
      push("l2_approved", b.condition);
    } else {
      return bad(`Cannot approve a request in status "${request.status}"`, 409);
    }
  } else if (action === "reject") {
    if (!["pending_l1", "pending_l2"].includes(request.status))
      return bad(`Cannot reject a request in status "${request.status}"`, 409);
    const lvl = request.status === "pending_l1" ? "requests.approve_l1" : "requests.approve_l2";
    if (!hasPermission(session.permissions, lvl)) return bad(`Forbidden — missing "${lvl}"`, 403);
    if (!b.note) return bad("A rejection reason is required");
    request.status = "rejected";
    request.rejectedReason = b.note;
    push("rejected", b.note);
  } else if (action === "complete") {
    if (request.status !== "approved")
      return bad("Only approved requests can be marked completed", 409);
    // requester or anyone who can assign work orders can close it out
    const isOwner = String(request.raisedById) === String(session.uid);
    if (!isOwner && !hasPermission(session.permissions, "maintenance.assign"))
      return bad("Forbidden", 403);
    request.status = "completed";
    request.completionNote = b.note;
    request.completedAt = new Date();
    push("completed", b.note);
  } else {
    return bad("Unknown action — use approve | reject | complete");
  }

  await request.save();
  await audit(session, `request.${action}`, `${action} ${request.code} → ${request.status}`, {
    entity: "WorkRequest",
    entityId: request._id,
  });

  // notify next actor / requester of the outcome
  if (request.status === "pending_l2")
    await notifyByPermission(session.societyId, "requests.approve_l2", {
      title: `${request.code} awaiting final approval`,
      body: request.title,
      kind: "workrequest",
      link: "/approvals",
      entityId: request._id,
    });
  if (["approved", "rejected", "completed"].includes(request.status) && request.raisedById)
    await notifyUsers(session.societyId, [request.raisedById], {
      title: `${request.code} ${request.status}`,
      body: request.status === "rejected" ? `Reason: ${request.rejectedReason}` : request.title,
      kind: "workrequest",
      link: "/approvals",
      entityId: request._id,
    });

  return ok({ request });
}
