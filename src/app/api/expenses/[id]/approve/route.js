import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import Expense from "@/models/Expense";

// Change a submitted expense's status. Body: { action: "approve"|"reject"|"pending", reason? }
// Status is reversible — an approved expense can be rejected or sent back to
// pending, and a rejected one re-approved. Defaults to approve.
export async function POST(req, { params }) {
  const guard = await authorize("expenses.approve");
  if (guard.error) return guard.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const action = b.action || "approve";

  const expense = await Expense.findOne(tenantFilter(guard.session, { _id: id }));
  if (!expense) return bad("Expense not found", 404);
  // a tower-scoped approver can only act on their own tower's expenses
  if (guard.session.scopeBlocks?.length && expense.blockCode && !guard.session.scopeBlocks.includes(expense.blockCode))
    return bad("This expense is outside your assigned tower(s)", 403);

  const was = expense.status;

  if (action === "reject") {
    if (!b.reason) return bad("A rejection reason is required");
    expense.status = "rejected";
    expense.rejectedReason = b.reason;
    expense.approvedBy = undefined;
  } else if (action === "pending") {
    // revert / discard a decision — back to pending for re-review
    expense.status = "pending";
    expense.rejectedReason = undefined;
    expense.approvedBy = undefined;
  } else if (action === "approve") {
    expense.status = "approved";
    expense.rejectedReason = undefined;
    expense.approvedBy = guard.session.uid;
  } else {
    return bad("Unknown action — use approve | reject | pending");
  }

  await expense.save();
  await audit(guard.session, `expense.${action}`, `Changed expense "${expense.category || "expense"}" ₹${expense.amount}: ${was} → ${expense.status}${b.reason ? ` (${b.reason})` : ""}`, {
    entity: "Expense",
    entityId: expense._id,
    meta: { from: was, to: expense.status },
  });
  return ok({ expense });
}
