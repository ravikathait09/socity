import { authorize, tenantFilter, blockScopedFilter, isBlockScoped, ok, bad } from "@/lib/api";
import MeterReading from "@/models/MeterReading";
import Unit from "@/models/Unit";

export async function GET(req) {
  const guard = await authorize("power.meter_readings");
  if (guard.error) return guard.error;
  const period = new URL(req.url).searchParams.get("period");
  const readings = await MeterReading.find(
    blockScopedFilter(guard.session, period ? { period } : {})
  ).lean();
  return ok({ readings });
}

export async function POST(req) {
  const guard = await authorize("power.meter_readings");
  if (guard.error) return guard.error;
  const b = await req.json().catch(() => ({}));
  if (!b.unitId || !b.period || b.current == null)
    return bad("unitId, period and current reading are required");

  const { session } = guard;
  const unit = await Unit.findOne(tenantFilter(session, { _id: b.unitId })).lean();
  if (!unit) return bad("Unit not found", 404);
  if (isBlockScoped(session) && !session.scopeBlocks.includes(unit.blockCode))
    return bad("This unit is outside your assigned tower(s)", 403);

  // previous reading defaults to last period's current, if any
  let previous = Number(b.previous || 0);
  if (b.previous == null) {
    const last = await MeterReading.findOne(
      tenantFilter(session, { unitId: b.unitId })
    )
      .sort({ period: -1 })
      .lean();
    if (last) previous = last.current;
  }
  const units = Math.max(0, Number(b.current) - previous);

  const reading = await MeterReading.findOneAndUpdate(
    tenantFilter(session, { unitId: b.unitId, period: b.period }),
    {
      societyId: session.societyId,
      unitId: b.unitId,
      blockCode: unit.blockCode,
      period: b.period,
      previous,
      current: Number(b.current),
      units,
      ratePerUnit: Number(b.ratePerUnit || 0),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return ok({ reading }, { status: 201 });
}
