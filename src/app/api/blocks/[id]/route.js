import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import Block from "@/models/Block";
import Unit from "@/models/Unit";

// Update a tower/block (units.block_config). Renaming the code cascades to the
// block's units so billing/scoping stay consistent.
export async function PATCH(req, { params }) {
  const guard = await authorize("units.block_config");
  if (guard.error) return guard.error;
  const { session } = guard;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const block = await Block.findOne(tenantFilter(session, { _id: id }));
  if (!block) return bad("Tower not found", 404);

  const oldCode = block.code;
  if (b.code !== undefined && String(b.code).trim() && String(b.code).trim() !== oldCode) {
    const newCode = String(b.code).trim();
    const clash = await Block.findOne(tenantFilter(session, { code: newCode }));
    if (clash) return bad("A tower with that code already exists");
    block.code = newCode;
    // cascade the rename to this tower's units
    await Unit.updateMany(tenantFilter(session, { blockCode: oldCode }), { blockCode: newCode });
  }
  if (b.name !== undefined) block.name = b.name;
  if (b.totalFloors !== undefined) block.totalFloors = b.totalFloors ? Number(b.totalFloors) : undefined;
  if (b.amenities !== undefined) block.amenities = Array.isArray(b.amenities) ? b.amenities : [];
  if (b.mode !== undefined) block.mode = b.mode;
  if (b.groupName !== undefined) block.groupName = b.groupName;

  try {
    await block.save();
  } catch (e) {
    return bad(e.code === 11000 ? "A tower with that code already exists" : e.message);
  }
  await audit(session, "block.update", `Updated tower ${block.code}`, { entity: "Block", entityId: block._id });
  return ok({ block });
}

// Delete a tower — only when it has no units (protects billing history).
export async function DELETE(req, { params }) {
  const guard = await authorize("units.block_config");
  if (guard.error) return guard.error;
  const { session } = guard;
  const { id } = await params;
  const block = await Block.findOne(tenantFilter(session, { _id: id }));
  if (!block) return bad("Tower not found", 404);
  const units = await Unit.countDocuments(tenantFilter(session, { blockCode: block.code }));
  if (units > 0) return bad(`Cannot delete tower ${block.code} — it still has ${units} unit(s). Move or remove them first.`, 409);
  await block.deleteOne();
  await audit(session, "block.delete", `Deleted tower ${block.code}`, { entity: "Block", entityId: id });
  return ok({ ok: true });
}
