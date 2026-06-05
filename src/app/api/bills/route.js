import { authorize, requireSession, tenantFilter, blockScopedFilter, ownedUnitIds, ok, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import Bill from "@/models/Bill";
import User from "@/models/User";

// List bills. Finance roles see all (within their tower scope); residents see
// only their own unit's bills.
export async function GET(req) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const period = new URL(req.url).searchParams.get("period");

  const canSeeAll = hasPermission(session.permissions, "billing.generate") ||
    hasPermission(session.permissions, "payments.record") ||
    hasPermission(session.permissions, "reports.dashboard");

  // finance roles are still bounded by their tower scope (owner = all towers)
  let filter = blockScopedFilter(session, period ? { period } : {});
  if (!canSeeAll) {
    if (!hasPermission(session.permissions, "billing.view_own"))
      return bad("Forbidden", 403);
    const me = await User.findById(session.uid).lean();
    const ids = ownedUnitIds(me);
    if (ids.length === 0) return ok({ bills: [] });
    filter = tenantFilter(session, { unitId: { $in: ids }, ...(period ? { period } : {}) });
  }

  const bills = await Bill.find(filter).sort({ period: -1, unitNumber: 1 }).lean();
  return ok({ bills });
}
