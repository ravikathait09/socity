import { authorize, tenantFilter, isBlockScoped, ok, bad } from "@/lib/api";
import { billStatus, round } from "@/lib/finance";
import { audit } from "@/lib/audit";
import Payment from "@/models/Payment";
import Bill from "@/models/Bill";

// Bulk-settle several bills in one go — records the full outstanding on each as a
// cash receipt. Body: { billIds: [], method? }. Skips bills that are already
// settled or outside the user's tower scope. (treasurer / accountant)
export async function POST(req) {
  const guard = await authorize("payments.record");
  if (guard.error) return guard.error;
  const { session } = guard;
  const { billIds, method = "cash", reference } = await req.json().catch(() => ({}));
  if (!Array.isArray(billIds) || billIds.length === 0) return bad("Select at least one bill");
  const allowed = ["cash", "upi", "bank", "cheque"];
  const payMethod = allowed.includes(method) ? method : "cash";

  const bills = await Bill.find(tenantFilter(session, { _id: { $in: billIds } }));
  let settled = 0;
  let total = 0;
  const skipped = [];

  for (const bill of bills) {
    if (isBlockScoped(session) && !session.scopeBlocks.includes(bill.blockCode)) {
      skipped.push(bill.unitNumber);
      continue;
    }
    const due = round((bill.total || 0) - (bill.paid || 0));
    if (due <= 0) {
      skipped.push(bill.unitNumber);
      continue;
    }
    await Payment.create({
      societyId: session.societyId,
      billId: bill._id,
      unitId: bill.unitId,
      blockCode: bill.blockCode,
      period: bill.period,
      amount: due,
      method: payMethod,
      reference: reference || `BULK-${bill.period}-${String(bill._id).slice(-6)}`,
      receivedBy: session.uid,
    });
    bill.paid = round((bill.paid || 0) + due);
    bill.status = billStatus(bill);
    await bill.save();
    settled++;
    total = round(total + due);
  }

  await audit(session, "payment.bulk", `Bulk-settled ${settled} bills (${total}) via ${payMethod}`, {
    entity: "Bill",
    meta: { settled, total, method: payMethod, skipped: skipped.length },
  });
  return ok({ settled, total, skipped: skipped.length });
}
