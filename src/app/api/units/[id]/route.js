import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import Unit from "@/models/Unit";

export async function PATCH(req, { params }) {
  const guard = await authorize("units.edit");
  if (guard.error) return guard.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const unit = await Unit.findOneAndUpdate(
    tenantFilter(guard.session, { _id: id }),
    body,
    { new: true }
  );
  if (!unit) return bad("Unit not found", 404);
  return ok({ unit });
}

export async function DELETE(req, { params }) {
  const guard = await authorize("units.edit");
  if (guard.error) return guard.error;
  const { id } = await params;
  const res = await Unit.deleteOne(tenantFilter(guard.session, { _id: id }));
  if (res.deletedCount === 0) return bad("Unit not found", 404);
  return ok({ ok: true });
}
