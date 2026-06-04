import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import Expense from "@/models/Expense";

// Approve or reject a submitted expense/bill. Body: { action?: "approve"|"reject", reason? }
// Defaults to approve (backwards compatible with the old endpoint).
export async function POST(req, { params }) {
  const guard = await authorize("expenses.approve");
  if (guard.error) return guard.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const action = b.action || "approve";

  const expense = await Expense.findOne(tenantFilter(guard.session, { _id: id }));
  if (!expense) return bad("Expense not found", 404);
  // a tower-scoped approver can only approve their own tower's expenses
  if (guard.session.scopeBlocks?.length && expense.blockCode && !guard.session.scopeBlocks.includes(expense.blockCode))
    return bad("This expense is outside your assigned tower(s)", 403);

  if (action === "reject") {
    if (!b.reason) return bad("A rejection reason is required");
    expense.status = "rejected";
    expense.rejectedReason = b.reason;
    await expense.save();
    await audit(guard.session, "expense.reject", `Rejected expense "${expense.category || "expense"}" ₹${expense.amount} — ${b.reason}`, {
      entity: "Expense",
      entityId: expense._id,
    });
    return ok({ expense });
  }

  expense.status = "approved";
  expense.rejectedReason = undefined;
  expense.approvedBy = guard.session.uid;
  await expense.save();
  await audit(guard.session, "expense.approve", `Approved expense "${expense.category || "expense"}" ₹${expense.amount}`, {
    entity: "Expense",
    entityId: expense._id,
  });
  return ok({ expense });
}
