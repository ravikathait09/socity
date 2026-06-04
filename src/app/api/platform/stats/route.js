import { authorize, ok } from "@/lib/api";
import Society from "@/models/Society";
import User from "@/models/User";
import Unit from "@/models/Unit";
import Bill from "@/models/Bill";

// Platform-level aggregate dashboard (super admin). NOT tenant-scoped — spans
// every society on the platform.
export async function GET() {
  const guard = await authorize("platform.onboard");
  if (guard.error) return guard.error;

  const societies = await Society.find().sort({ createdAt: -1 }).lean();
  const active = societies.filter((s) => s.active !== false).length;

  // per-society user + unit counts (small N of tenants)
  const rows = [];
  for (const s of societies) {
    const [userCount, unitCount] = await Promise.all([
      User.countDocuments({ societyId: s._id }),
      Unit.countDocuments({ societyId: s._id }),
    ]);
    rows.push({
      _id: s._id,
      name: s.name,
      slug: s.slug,
      city: s.city,
      active: s.active !== false,
      createdAt: s.createdAt,
      userCount,
      unitCount,
    });
  }

  const [tenantUsers, totalUnits] = await Promise.all([
    User.countDocuments({ societyId: { $ne: null } }),
    Unit.countDocuments(),
  ]);

  // platform-wide billing rollup (all tenants)
  const billAgg = (await Bill.aggregate([
    { $group: { _id: null, billed: { $sum: "$total" }, collected: { $sum: "$paid" } } },
  ]))[0] || { billed: 0, collected: 0 };

  return ok({
    stats: {
      societies: societies.length,
      activeSocieties: active,
      suspendedSocieties: societies.length - active,
      tenantUsers,
      totalUnits,
      totalBilled: Math.round(billAgg.billed),
      totalCollected: Math.round(billAgg.collected),
    },
    societies: rows,
  });
}
