import { requireSession, tenantFilter, blockScopedFilter, isBlockScoped, ok, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notifyByPermission } from "@/lib/notify";
import WorkRequest from "@/models/WorkRequest";
import Society from "@/models/Society";

const TYPES = ["material", "service", "repair", "overtime", "event", "emergency"];

// List requests. requests.view_all -> all (tower-scoped); else own raised.
export async function GET() {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const canSeeAll = hasPermission(session.permissions, "requests.view_all");
  const canRaise = hasPermission(session.permissions, "requests.raise");
  const canApprove = hasPermission(session.permissions, "requests.approve_l1") || hasPermission(session.permissions, "requests.approve_l2");
  if (!canSeeAll && !canRaise && !canApprove) return bad("Forbidden", 403);

  const filter = canSeeAll || canApprove
    ? blockScopedFilter(session)
    : tenantFilter(session, { raisedById: session.uid });
  const requests = await WorkRequest.find(filter).sort({ createdAt: -1 }).lean();
  return ok({ requests });
}

// Raise a request → enters the approval workflow.
export async function POST(req) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  if (!hasPermission(session.permissions, "requests.raise"))
    return bad('Forbidden — missing permission "requests.raise"', 403);

  const b = await req.json().catch(() => ({}));
  if (!b.title) return bad("title is required");

  const society = await Society.findById(session.societyId).lean();
  const levels = society?.settings?.approvalLevels ?? 2;

  // Emergency bypass: skip Level 1, go straight to Chairman. Only a user who can
  // assign work orders (Society Manager) may flag a request emergency.
  const emergency = !!b.emergency && hasPermission(session.permissions, "maintenance.assign");

  // tower-scoped users tag their tower
  let blockCode = b.blockCode;
  if (isBlockScoped(session)) blockCode = session.scopeBlocks[0];

  const count = await WorkRequest.countDocuments(tenantFilter(session));
  const code = `REQ-${String(count + 1).padStart(4, "0")}`;

  const items = Array.isArray(b.items)
    ? b.items.map((i) => ({ name: i.name, qty: Number(i.qty) || 0, estCost: Number(i.estCost) || 0 }))
    : [];
  const estimatedCost = items.length
    ? items.reduce((s, i) => s + (i.estCost || 0) * (i.qty || 1), 0)
    : Number(b.estimatedCost) || 0;

  // Determine the starting status.
  let status = "pending_l1";
  if (levels <= 1) status = "approved";
  else if (emergency) status = "pending_l2";

  const request = await WorkRequest.create({
    societyId: session.societyId,
    code,
    type: TYPES.includes(b.type) ? b.type : "material",
    title: b.title,
    description: b.description,
    items,
    estimatedCost,
    vendorName: b.vendorName,
    blockCode,
    emergency,
    raisedById: session.uid,
    raisedByName: session.name,
    levels,
    status,
    escalateAfterDays: Number(b.escalateAfterDays) || 3,
    history: [{ actorId: session.uid, actorName: session.name, action: "raised", note: emergency ? "Emergency — Level 1 bypassed" : undefined }],
  });

  await audit(session, "request.raise", `Raised ${code}: ${request.title} (₹${estimatedCost})`, {
    entity: "WorkRequest",
    entityId: request._id,
  });
  // alert the next approver tier
  const nextPerm = status === "pending_l2" ? "requests.approve_l2" : "requests.approve_l1";
  if (status !== "approved")
    await notifyByPermission(session.societyId, nextPerm, {
      title: `New request ${code} awaiting your approval`,
      body: `${request.title} — ₹${estimatedCost}`,
      kind: "workrequest",
      link: "/approvals",
      entityId: request._id,
    });
  return ok({ request }, { status: 201 });
}
