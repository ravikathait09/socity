import bcrypt from "bcryptjs";
import { authorize, tenantFilter, isBlockScoped, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import User from "@/models/User";
import Role from "@/models/Role";
import { towerUserFilter, assertAssignableRoles, constrainScope } from "@/lib/userScope";

// Resolve role ids to the names a user holds (for display).
async function withRoleNames(users, session) {
  const roles = await Role.find(tenantFilter(session)).lean();
  const byId = new Map(roles.map((r) => [String(r._id), r.name]));
  return users.map((u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    active: u.active,
    unitId: u.unitId,
    scopeBlocks: u.scopeBlocks || [],
    roleIds: (u.roleIds || []).map(String),
    roles: (u.roleIds || []).map((id) => byId.get(String(id))).filter(Boolean),
  }));
}

// List users. Society-wide admins see everyone; a tower admin (block-scoped)
// sees only users belonging to their tower(s).
export async function GET() {
  const guard = await authorize("admin.users");
  if (guard.error) return guard.error;
  const filter = await towerUserFilter(guard.session);
  const users = await User.find(filter).sort({ createdAt: 1 }).lean();
  return ok({ users: await withRoleNames(users, guard.session), scoped: isBlockScoped(guard.session) });
}

// Create a user. A tower admin may only create users within their tower and may
// not grant escalating / platform roles.
export async function POST(req) {
  const guard = await authorize("admin.users");
  if (guard.error) return guard.error;
  const { session } = guard;
  const b = await req.json().catch(() => ({}));
  if (!b.name || !b.email || !b.password)
    return bad("name, email and password are required");

  const roleCheck = await assertAssignableRoles(b.roleIds || [], session);
  if (roleCheck.error) return bad(roleCheck.error, 400);

  const scope = await constrainScope(b, session);
  if (scope.error) return bad(scope.error, 403);

  try {
    const user = await User.create({
      societyId: session.societyId,
      name: b.name,
      email: b.email,
      passwordHash: await bcrypt.hash(b.password, 10),
      roleIds: roleCheck.ids,
      unitId: scope.unitId || undefined,
      scopeBlocks: Array.isArray(scope.scopeBlocks) ? scope.scopeBlocks : [],
      active: true,
    });
    const [shaped] = await withRoleNames([user.toObject()], session);
    await audit(session, "user.create", `Created user ${shaped.name} (${shaped.email}) with roles: ${shaped.roles.join(", ") || "none"}${shaped.scopeBlocks.length ? ` · tower ${shaped.scopeBlocks.join(",")}` : ""}`, {
      entity: "User",
      entityId: user._id,
    });
    return ok({ user: shaped }, { status: 201 });
  } catch (e) {
    return bad(e.code === 11000 ? "A user with that email already exists" : e.message);
  }
}
