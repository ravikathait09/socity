import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import Block from "@/models/Block";
import Unit from "@/models/Unit";

export async function GET() {
  const guard = await authorize("units.view");
  if (guard.error) return guard.error;
  const blocks = await Block.find(tenantFilter(guard.session)).sort({ code: 1 }).lean();
  // attach live unit counts
  for (const b of blocks) {
    b.unitCount = await Unit.countDocuments(
      tenantFilter(guard.session, { blockCode: b.code })
    );
  }
  return ok({ blocks });
}

export async function POST(req) {
  const guard = await authorize("units.block_config");
  if (guard.error) return guard.error;
  const body = await req.json().catch(() => ({}));
  if (!body.code) return bad("Block code is required");
  try {
    const block = await Block.create({
      societyId: guard.session.societyId,
      code: String(body.code).trim(),
      name: body.name,
      totalFloors: body.totalFloors ? Number(body.totalFloors) : undefined,
      amenities: Array.isArray(body.amenities) ? body.amenities : [],
      mode: body.mode || "standalone",
      groupName: body.groupName,
    });
    return ok({ block }, { status: 201 });
  } catch (e) {
    return bad(e.code === 11000 ? "Block code already exists" : e.message);
  }
}
