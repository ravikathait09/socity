import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import Role from "@/models/Role";
import User from "@/models/User";

export async function PATCH(req, { params }) {
  const guard = await authorize("admin.roles");
  if (guard.error) return guard.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const update = {};
  if (b.name != null) update.name = b.name;
  if (b.description != null) update.description = b.description;
  if (b.permissions != null) update.permissions = b.permissions;
  const role = await Role.findOneAndUpdate(
    tenantFilter(guard.session, { _id: id }),
    update,
    { new: true }
  );
  if (!role) return bad("Role not found", 404);
  // if permissions changed, invalidate the JWT snapshot of everyone holding this role
  if (b.permissions != null) {
    await User.updateMany(
      tenantFilter(guard.session, { roleIds: role._id }),
      { $inc: { permVersion: 1 } }
    );
  }
  await audit(guard.session, "role.update", `Updated role "${role.name}" (${role.permissions.length} permissions)`, {
    entity: "Role",
    entityId: role._id,
  });
  return ok({ role });
}

export async function DELETE(req, { params }) {
  const guard = await authorize("admin.roles");
  if (guard.error) return guard.error;
  const { id } = await params;
  const role = await Role.findOne(tenantFilter(guard.session, { _id: id }));
  if (!role) return bad("Role not found", 404);
  if (role.system) return bad("System roles cannot be deleted", 400);
  await role.deleteOne();
  return ok({ ok: true });
}
