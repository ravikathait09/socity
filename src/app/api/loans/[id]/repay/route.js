import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { loanSummary, round } from "@/lib/finance";
import Loan from "@/models/Loan";

// Record a repayment (e.g. an EMI) against a loan. Auto-closes when the loan's
// total payable has been repaid.
export async function POST(req, { params }) {
  const guard = await authorize("finance.legal");
  if (guard.error) return guard.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const amount = round(Number(b.amount));
  if (!amount || amount <= 0) return bad("A positive amount is required");

  const loan = await Loan.findOne(tenantFilter(guard.session, { _id: id }));
  if (!loan) return bad("Loan not found", 404);

  loan.repaid = round((loan.repaid || 0) + amount);
  const summary = loanSummary(loan);
  if (summary.outstanding <= 0) loan.status = "closed";
  await loan.save();

  return ok({ loan: { ...loan.toObject(), summary: loanSummary(loan) } });
}
