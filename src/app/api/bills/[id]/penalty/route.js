import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { billStatus, round } from "@/lib/finance";
import { audit } from "@/lib/audit";
import Bill from "@/models/Bill";

// Apply a penalty or a waiver to a single bill (treasurer / society admin).
//   { amount, type: "penalty" | "waiver" }
// penalty adds to bill.penalty and total; waiver reduces it (not below 0).
export async function POST(req, { params }) {
  const guard = await authorize("billing.penalty");
  if (guard.error) return guard.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const amount = round(Number(b.amount));
  if (!amount || amount <= 0) return bad("A positive amount is required");
  const type = b.type === "waiver" ? "waiver" : "penalty";

  const bill = await Bill.findOne(tenantFilter(guard.session, { _id: id }));
  if (!bill) return bad("Bill not found", 404);
  if (guard.session.scopeBlocks?.length && !guard.session.scopeBlocks.includes(bill.blockCode))
    return bad("This bill is outside your assigned tower(s)", 403);

  const delta = type === "waiver" ? -amount : amount;
  const newPenalty = Math.max(0, round((bill.penalty || 0) + delta));
  const applied = round(newPenalty - (bill.penalty || 0)); // actual change after clamping

  // total = charges + penalty, so adjust total by the actual penalty change
  bill.total = round((bill.total || 0) + applied);
  bill.penalty = newPenalty;
  bill.status = billStatus(bill);
  await bill.save();

  await audit(guard.session, `bill.${type}`, `${type === "waiver" ? "Waived" : "Applied"} ₹${Math.abs(applied)} on ${bill.unitNumber} (${bill.period})`, {
    entity: "Bill",
    entityId: bill._id,
    meta: { type, applied },
  });
  return ok({ bill, applied });
}
