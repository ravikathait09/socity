import { requireSession, tenantFilter, ownedUnitIds, ok, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import User from "@/models/User";
import Unit from "@/models/Unit";

// The resident's own flat(s). GET returns every flat they own; PATCH lets the
// owner maintain a given flat's TENANT details + occupancy. Gated by units.view_own.
export async function GET() {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  if (!hasPermission(session.permissions, "units.view_own")) return bad("Forbidden", 403);
  const me = await User.findById(session.uid).lean();
  const ids = ownedUnitIds(me);
  if (ids.length === 0) return ok({ units: [] });
  const units = await Unit.find(tenantFilter(session, { _id: { $in: ids } })).sort({ number: 1 }).lean();
  return ok({ units });
}

export async function PATCH(req) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  if (!hasPermission(session.permissions, "units.view_own")) return bad("Forbidden", 403);
  const b = await req.json().catch(() => ({}));
  const me = await User.findById(session.uid).lean();
  const ids = ownedUnitIds(me);
  // which flat — defaults to the only/primary one
  const target = b.unitId && ids.includes(String(b.unitId)) ? b.unitId : ids[0];
  if (!target) return bad("No flat linked to your account", 404);

  const update = {};
  for (const k of ["tenantName", "tenantPhone", "tenantEmail"]) {
    if (b[k] !== undefined) update[k] = b[k];
  }
  if (b.leaseStart !== undefined) update.leaseStart = b.leaseStart ? new Date(b.leaseStart) : null;
  if (b.leaseEnd !== undefined) update.leaseEnd = b.leaseEnd ? new Date(b.leaseEnd) : null;
  if (b.occupancy !== undefined && ["owner", "tenant", "vacant"].includes(b.occupancy))
    update.occupancy = b.occupancy;

  const unit = await Unit.findOneAndUpdate(tenantFilter(session, { _id: target }), update, { new: true }).lean();
  if (!unit) return bad("Flat not found", 404);
  await audit(session, "unit.tenant_update", `Resident updated tenant details for ${unit.number}`, {
    entity: "Unit", entityId: unit._id, meta: { fields: Object.keys(update) },
  });
  return ok({ unit });
}
