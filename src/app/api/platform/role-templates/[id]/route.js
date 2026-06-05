import { authorize, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import RoleTemplate from "@/models/RoleTemplate";

export async function PATCH(req, { params }) {
  const guard = await authorize("platform.onboard");
  if (guard.error) return guard.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const tpl = await RoleTemplate.findById(id);
  if (!tpl) return bad("Template not found", 404);
  if (b.description !== undefined) tpl.description = b.description;
  if (Array.isArray(b.permissions)) tpl.permissions = b.permissions;
  if (b.name && !tpl.system) tpl.name = b.name; // system template names are fixed
  if (b.sortOrder !== undefined) tpl.sortOrder = Number(b.sortOrder) || 0;
  try {
    await tpl.save();
  } catch (e) {
    return bad(e.code === 11000 ? "A template with that name exists" : e.message);
  }
  await audit(guard.session, "role_template.update", `Updated role template "${tpl.name}"`, { entity: "RoleTemplate", entityId: tpl._id });
  return ok({ template: tpl });
}

export async function DELETE(req, { params }) {
  const guard = await authorize("platform.onboard");
  if (guard.error) return guard.error;
  const { id } = await params;
  const tpl = await RoleTemplate.findById(id);
  if (!tpl) return bad("Template not found", 404);
  if (tpl.system) return bad("Built-in templates can't be deleted (edit them instead)", 400);
  await tpl.deleteOne();
  await audit(guard.session, "role_template.delete", `Deleted role template "${tpl.name}"`, { entity: "RoleTemplate", entityId: id });
  return ok({ ok: true });
}
