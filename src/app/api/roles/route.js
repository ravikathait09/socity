import { authorize, requireSession, tenantFilter, ok, bad } from "@/lib/api";
import { hasAny } from "@/lib/rbac";
import Role from "@/models/Role";

// Listing roles is needed both by role admins and by user managers (to populate
// the role-assignment UI), so allow either admin.roles or admin.users to read.
export async function GET() {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  if (!hasAny(session.permissions, ["admin.roles", "admin.users"]))
    return bad("Forbidden", 403);
  const roles = await Role.find(tenantFilter(session))
    .sort({ system: -1, name: 1 })
    .lean();
  return ok({ roles });
}

export async function POST(req) {
  const guard = await authorize("admin.roles");
  if (guard.error) return guard.error;
  const b = await req.json().catch(() => ({}));
  if (!b.name) return bad("Role name is required");
  try {
    const role = await Role.create({
      societyId: guard.session.societyId,
      name: b.name,
      description: b.description,
      permissions: b.permissions || [],
      system: false,
    });
    return ok({ role }, { status: 201 });
  } catch (e) {
    return bad(e.code === 11000 ? "Role name already exists" : e.message);
  }
}
