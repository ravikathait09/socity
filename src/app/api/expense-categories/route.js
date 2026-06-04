import { requireSession, authorize, tenantFilter, ok, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import ExpenseCategory from "@/models/ExpenseCategory";

// List categories. Any member who can add/submit/manage expenses needs the list
// to populate dropdowns; managing (create) is gated by expenses.categories.
export async function GET() {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const filter = tenantFilter(session);
  // non-managers only see active categories
  if (!hasPermission(session.permissions, "expenses.categories")) filter.active = true;
  const categories = await ExpenseCategory.find(filter)
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  return ok({ categories });
}

export async function POST(req) {
  const guard = await authorize("expenses.categories");
  if (guard.error) return guard.error;
  const { session } = guard;
  const b = await req.json().catch(() => ({}));
  if (!b.name || !b.code) return bad("name and code are required");
  try {
    const category = await ExpenseCategory.create({
      societyId: session.societyId,
      name: b.name,
      code: String(b.code).toUpperCase().replace(/\s+/g, "_"),
      allocationType: ["all", "specific", "both"].includes(b.allocationType) ? b.allocationType : "all",
      budgetHead: b.budgetHead,
      gstApplicable: !!b.gstApplicable,
      requiresApproval: b.requiresApproval !== false,
      approvalLevel: b.approvalLevel === 1 ? 1 : 2,
      parentCode: b.parentCode,
      spendLimitPerMonth: b.spendLimitPerMonth ? Number(b.spendLimitPerMonth) : undefined,
      sortOrder: Number(b.sortOrder) || 0,
    });
    await audit(session, "expense_category.create", `Added expense category ${category.name} (${category.code})`, {
      entity: "ExpenseCategory",
      entityId: category._id,
    });
    return ok({ category }, { status: 201 });
  } catch (e) {
    return bad(e.code === 11000 ? "A category with that code exists" : e.message);
  }
}
