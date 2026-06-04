import { requireSession, tenantFilter, blockScopedFilter, ok, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notifyByPermission } from "@/lib/notify";
import MaintenanceRequest from "@/models/MaintenanceRequest";
import User from "@/models/User";
import Unit from "@/models/Unit";

const MAX_INLINE_BYTES = 1.5 * 1024 * 1024;

// List requests. maintenance.view_all -> all; otherwise (maintenance.raise) ->
// only the requests this user raised.
export async function GET() {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);

  const canSeeAll = hasPermission(session.permissions, "maintenance.view_all");
  const canRaise = hasPermission(session.permissions, "maintenance.raise");
  if (!canSeeAll && !canRaise) return bad("Forbidden", 403);

  // managers see all within their tower scope; residents see their own raised
  const filter = canSeeAll
    ? blockScopedFilter(session)
    : tenantFilter(session, { raisedById: session.uid });
  const requests = await MaintenanceRequest.find(filter)
    .select("-photo.contentBase64")
    .sort({ createdAt: -1 })
    .lean();
  return ok({ requests });
}

// Raise a complaint / request.
export async function POST(req) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  if (!hasPermission(session.permissions, "maintenance.raise"))
    return bad('Forbidden — missing permission "maintenance.raise"', 403);

  const b = await req.json().catch(() => ({}));
  if (!b.title) return bad("title is required");

  // sequential WO code per society
  const count = await MaintenanceRequest.countDocuments(tenantFilter(session));
  const code = `WO-${String(count + 1).padStart(4, "0")}`;

  // link the raiser's unit if they have one
  const me = await User.findById(session.uid).lean();
  let unitNumber, blockCode;
  if (me?.unitId) {
    const unit = await Unit.findOne(tenantFilter(session, { _id: me.unitId })).lean();
    unitNumber = unit?.number;
    blockCode = unit?.blockCode;
  }

  // optional photo evidence
  let photo;
  if (b.photo?.contentBase64) {
    const size = Math.floor((b.photo.contentBase64.length * 3) / 4);
    if (size > MAX_INLINE_BYTES) return bad("Photo too large (max 1.5 MB)", 413);
    photo = { name: b.photo.name || "photo", mimeType: b.photo.mimeType, size, contentBase64: b.photo.contentBase64 };
  }

  const request = await MaintenanceRequest.create({
    societyId: session.societyId,
    code,
    title: b.title,
    description: b.description,
    category: b.category || "general",
    priority: ["low", "medium", "high"].includes(b.priority) ? b.priority : "medium",
    raisedById: session.uid,
    raisedByName: session.name,
    unitId: me?.unitId,
    unitNumber,
    blockCode,
    slaHours: b.slaHours ? Number(b.slaHours) : undefined,
    photo,
    status: "open",
  });
  await audit(session, "maintenance.raise", `Raised ${code}: ${request.title}`, {
    entity: "MaintenanceRequest",
    entityId: request._id,
  });
  await notifyByPermission(session.societyId, "maintenance.assign", {
    title: `New complaint ${code}`,
    body: request.title,
    kind: "maintenance",
    link: "/maintenance",
    entityId: request._id,
  });
  return ok({ request }, { status: 201 });
}
