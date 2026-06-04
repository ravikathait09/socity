import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { loanSummary } from "@/lib/finance";
import Loan from "@/models/Loan";
import LegalEntity from "@/models/LegalEntity";

export async function GET(req) {
  const guard = await authorize("finance.legal");
  if (guard.error) return guard.error;
  const entityId = new URL(req.url).searchParams.get("entityId");
  const filter = tenantFilter(guard.session, entityId ? { legalEntityId: entityId } : {});
  const loans = await Loan.find(filter).sort({ createdAt: -1 }).lean();
  // attach computed EMI / outstanding
  const withSummary = loans.map((l) => ({ ...l, summary: loanSummary(l) }));
  return ok({ loans: withSummary });
}

export async function POST(req) {
  const guard = await authorize("finance.legal");
  if (guard.error) return guard.error;
  const { session } = guard;
  const b = await req.json().catch(() => ({}));
  if (!b.legalEntityId || !b.purpose || !b.principal || !b.tenureMonths)
    return bad("legalEntityId, purpose, principal and tenureMonths are required");

  const entity = await LegalEntity.findOne(
    tenantFilter(session, { _id: b.legalEntityId })
  ).lean();
  if (!entity) return bad("Legal entity not found", 404);

  const loan = await Loan.create({
    societyId: session.societyId,
    legalEntityId: b.legalEntityId,
    purpose: b.purpose,
    lender: b.lender,
    principal: Number(b.principal),
    annualRate: Number(b.annualRate || 0),
    tenureMonths: Number(b.tenureMonths),
    startDate: b.startDate ? new Date(b.startDate) : undefined,
  });
  return ok({ loan: { ...loan.toObject(), summary: loanSummary(loan) } }, { status: 201 });
}
