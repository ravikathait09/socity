import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import ExpenseCategory from "@/models/ExpenseCategory";
import Expense from "@/models/Expense";

export async function PATCH(req, { params }) {
  const guard = await authorize("expenses.categories");
  if (guard.error) return guard.error;
  const { session } = guard;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const update = {};
  // code/rename apply to NEW entries only; existing expenses keep their label.
  for (const k of ["name", "budgetHead", "gstApplicable", "requiresApproval", "parentCode", "active", "allocationType", "approvalLevel", "sortOrder", "spendLimitPerMonth"]) {
    if (b[k] !== undefined) update[k] = b[k];
  }
  const category = await ExpenseCategory.findOneAndUpdate(
    tenantFilter(session, { _id: id }),
    update,
    { new: true }
  );
  if (!category) return bad("Category not found", 404);
  await audit(session, "expense_category.update", `Updated category ${category.name}`, {
    entity: "ExpenseCategory",
    entityId: category._id,
    meta: { fields: Object.keys(update) },
  });
  return ok({ category });
}

// Soft-delete only: categories with existing transactions are deactivated, never
// hard-deleted (history preserved).
export async function DELETE(req, { params }) {
  const guard = await authorize("expenses.categories");
  if (guard.error) return guard.error;
  const { session } = guard;
  const { id } = await params;
  const category = await ExpenseCategory.findOne(tenantFilter(session, { _id: id }));
  if (!category) return bad("Category not found", 404);
  const used = await Expense.countDocuments(tenantFilter(session, { categoryCode: category.code }));
  if (used > 0) {
    category.active = false;
    await category.save();
    await audit(session, "expense_category.deactivate", `Deactivated category ${category.name} (${used} transactions)`, {
      entity: "ExpenseCategory",
      entityId: category._id,
    });
    return ok({ category, deactivated: true });
  }
  await category.deleteOne();
  await audit(session, "expense_category.delete", `Deleted category ${category.name}`, {
    entity: "ExpenseCategory",
    entityId: id,
  });
  return ok({ ok: true });
}
