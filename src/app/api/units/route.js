import { authorize, tenantFilter, blockScopedFilter, isBlockScoped, ok, bad } from "@/lib/api";
import Unit from "@/models/Unit";
import Block from "@/models/Block";

export async function GET() {
  const guard = await authorize("units.view");
  if (guard.error) return guard.error;
  const units = await Unit.find(blockScopedFilter(guard.session)).sort({ number: 1 }).lean();
  return ok({ units });
}

export async function POST(req) {
  const guard = await authorize("units.edit");
  if (guard.error) return guard.error;
  const body = await req.json().catch(() => ({}));
  if (!body.number) return bad("Unit number is required");

  const { session } = guard;
  let blockCode = body.blockCode;
  let blockId = body.blockId;
  if (blockId) {
    const block = await Block.findOne(tenantFilter(session, { _id: blockId })).lean();
    if (block) blockCode = block.code;
  }

  // a tower-scoped user can only create units within their own tower(s)
  if (isBlockScoped(session) && !session.scopeBlocks.includes(blockCode)) {
    return bad("You can only add units within your assigned tower(s)", 403);
  }

  try {
    const unit = await Unit.create({
      societyId: session.societyId,
      blockId: blockId || undefined,
      blockCode,
      number: body.number,
      floor: body.floor,
      areaSqft: body.areaSqft,
      bhk: body.bhk,
      waterInlets: body.waterInlets ?? 1,
      monthlyMaintenance: body.monthlyMaintenance ? Number(body.monthlyMaintenance) : undefined,
      ownerName: body.ownerName,
      ownerPhone: body.ownerPhone,
      ownerEmail: body.ownerEmail,
      ownerPan: body.ownerPan,
      ownerAadhaar: body.ownerAadhaar,
      tenantName: body.tenantName,
      tenantPhone: body.tenantPhone,
      tenantEmail: body.tenantEmail,
      leaseStart: body.leaseStart || undefined,
      leaseEnd: body.leaseEnd || undefined,
      occupancy: body.occupancy || "owner",
      meterNo: body.meterNo,
    });
    return ok({ unit }, { status: 201 });
  } catch (e) {
    return bad(e.code === 11000 ? "A unit with that number already exists" : e.message);
  }
}
