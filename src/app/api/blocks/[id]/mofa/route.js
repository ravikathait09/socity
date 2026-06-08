import { requireSession, tenantFilter, isBlockScoped, ok, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import Block from "@/models/Block";

// Set per-tower MOFA charge-head overrides. Society admins (units.edit, no scope)
// can edit any tower; a Tower Admin (units.edit + scope) only their own tower(s).
// Body: { mofaOverride: bool, settings: { maintenanceBasis, serviceChargePerFlat,
// serviceChargePerSqft, sinkingFundRatePerSqft, repairFundRatePerSqft, waterChargePerInlet } }
export async function PATCH(req, { params }) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  if (!hasPermission(session.permissions, "units.edit")) return bad("Forbidden", 403);
  const { id } = await params;

  const block = await Block.findOne(tenantFilter(session, { _id: id }));
  if (!block) return bad("Tower not found", 404);
  if (isBlockScoped(session) && !session.scopeBlocks.includes(block.code))
    return bad("That tower is outside your assigned tower(s)", 403);

  const b = await req.json().catch(() => ({}));
  if (b.mofaOverride !== undefined) block.mofaOverride = !!b.mofaOverride;

  if (b.settings && typeof b.settings === "object") {
    const s = b.settings;
    // empty string / null => inherit society default; numbers stored as-is
    const num = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
    block.settings = {
      maintenanceBasis: ["flat", "sqft"].includes(s.maintenanceBasis) ? s.maintenanceBasis : null,
      serviceChargePerFlat: num(s.serviceChargePerFlat),
      serviceChargePerSqft: num(s.serviceChargePerSqft),
      sinkingFundRatePerSqft: num(s.sinkingFundRatePerSqft),
      repairFundRatePerSqft: num(s.repairFundRatePerSqft),
      waterChargePerInlet: num(s.waterChargePerInlet),
    };
  }

  await block.save();
  await audit(session, "block.mofa", `Updated tower ${block.code} charge overrides (${block.mofaOverride ? "on" : "off"})`, {
    entity: "Block",
    entityId: block._id,
  });
  return ok({ block });
}
