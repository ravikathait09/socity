import { requireSession, tenantFilter, ok, bad } from "@/lib/api";
import { hasAny } from "@/lib/rbac";
import Vendor from "@/models/Vendor";

// Lightweight active-vendor list for pickers (e.g. the expense form). Available
// to anyone who can add/submit expenses or manage vendors — not just vendor
// admins — so a Treasurer can attach a vendor without the full vendors module.
export async function GET() {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  if (!hasAny(session.permissions, ["expenses.add", "expenses.submit", "maintenance.vendors", "vendors.contracts"]))
    return bad("Forbidden", 403);
  const vendors = await Vendor.find(tenantFilter(session, { active: true, blacklisted: { $ne: true } }))
    .select("name serviceCategory trade")
    .sort({ name: 1 })
    .lean();
  return ok({ vendors });
}
