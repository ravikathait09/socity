import { requireSession, tenantFilter, ok, bad } from "@/lib/api";
import User from "@/models/User";

// Minimal active-user list (id + name) for in-charge / assignment dropdowns.
// Any authenticated member of the society may read it.
export async function GET() {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const users = await User.find(tenantFilter(session, { active: true }))
    .select("name")
    .sort({ name: 1 })
    .lean();
  return ok({ users });
}
