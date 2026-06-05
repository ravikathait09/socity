import bcrypt from "bcryptjs";
import { authorize, tenantFilter, isBlockScoped, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import User from "@/models/User";
import { towerUserFilter, assertAssignableRoles, constrainScope } from "@/lib/userScope";

// Confirm the actor is allowed to manage this target user (tower admins only
// within their tower). Returns the target doc or null.
async function targetInScope(id, session) {
  const filter = await towerUserFilter(session);
  filter._id = id;
  return User.findOne(filter).lean();
}

// Update a user — assign/remove roles, rename, link a unit, scope, activate.
export async function PATCH(req, { params }) {
  const guard = await authorize("admin.users");
  if (guard.error) return guard.error;
  const { session } = guard;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  // tower admins can only touch users inside their tower(s)
  if (isBlockScoped(session) && !(await targetInScope(id, session)))
    return bad("That user is outside your assigned tower(s)", 403);

  const update = {};
  if (b.name != null) update.name = b.name;
  if (b.active != null) update.active = !!b.active;
  if (b.password) update.passwordHash = await bcrypt.hash(b.password, 10);

  // scope + unit changes are constrained for tower admins
  if (b.scopeBlocks !== undefined || b.unitId !== undefined) {
    const scope = await constrainScope(b, session);
    if (scope.error) return bad(scope.error, 403);
    if (b.scopeBlocks !== undefined) update.scopeBlocks = Array.isArray(scope.scopeBlocks) ? scope.scopeBlocks : [];
    if (b.unitId !== undefined) {
      update.unitId = scope.unitId || null;
      // keep the multi-flat list in sync with a manual single-flat assignment
      update.unitIds = scope.unitId ? [scope.unitId] : [];
    }
  }

  if (b.roleIds != null) {
    const roleCheck = await assertAssignableRoles(b.roleIds, session);
    if (roleCheck.error) return bad(roleCheck.error, 400);
    update.roleIds = roleCheck.ids;
  }
  // role / scope / active changes invalidate the user's existing JWT snapshot
  if (update.roleIds !== undefined || update.active !== undefined || update.scopeBlocks !== undefined) {
    update.$inc = { permVersion: 1 };
  }

  const user = await User.findOneAndUpdate(
    tenantFilter(session, { _id: id }),
    update,
    { new: true }
  ).lean();
  if (!user) return bad("User not found", 404);
  await audit(session, "user.update", `Updated ${user.name} (${Object.keys(update).join(", ")})`, {
    entity: "User",
    entityId: user._id,
    meta: { fields: Object.keys(update) },
  });
  return ok({ user: { _id: user._id, name: user.name, active: user.active, roleIds: user.roleIds, scopeBlocks: user.scopeBlocks } });
}

export async function DELETE(req, { params }) {
  const guard = await authorize("admin.users");
  if (guard.error) return guard.error;
  const { session } = guard;
  const { id } = await params;
  if (String(id) === String(session.uid))
    return bad("You cannot remove your own account", 400);
  if (isBlockScoped(session) && !(await targetInScope(id, session)))
    return bad("That user is outside your assigned tower(s)", 403);
  const target = await User.findOne(tenantFilter(session, { _id: id })).lean();
  const res = await User.deleteOne(tenantFilter(session, { _id: id }));
  if (res.deletedCount === 0) return bad("User not found", 404);
  await audit(session, "user.delete", `Removed user ${target?.name || id}`, {
    entity: "User",
    entityId: id,
  });
  return ok({ ok: true });
}
