import { authorize, tenantFilter, ownedUnitIds, ok, bad } from "@/lib/api";
import { billStatus, round } from "@/lib/finance";
import { audit } from "@/lib/audit";
import Payment from "@/models/Payment";
import Bill from "@/models/Bill";
import User from "@/models/User";

// Resident "pay online" — a stubbed gateway that settles the outstanding amount
// on one of the resident's OWN bills. (Real PSP integration is a later step.)
export async function POST(req) {
  const guard = await authorize("payments.pay_online");
  if (guard.error) return guard.error;
  const { session } = guard;
  const { billId } = await req.json().catch(() => ({}));
  if (!billId) return bad("billId is required");

  const me = await User.findById(session.uid).lean();
  const ids = ownedUnitIds(me);
  if (ids.length === 0) return bad("No unit linked to your account", 400);

  // Must be one of the resident's own flats' bills — tenant + ownership scoped.
  const bill = await Bill.findOne(
    tenantFilter(session, { _id: billId, unitId: { $in: ids } })
  );
  if (!bill) return bad("Bill not found", 404);

  const outstanding = round((bill.total || 0) - (bill.paid || 0));
  if (outstanding <= 0) return bad("Bill already settled", 400);

  const payment = await Payment.create({
    societyId: session.societyId,
    billId: bill._id,
    unitId: bill.unitId,
    period: bill.period,
    amount: outstanding,
    method: "online",
    reference: `ONLINE-${bill.period}-${String(bill._id).slice(-6)}`,
    receivedBy: session.uid,
  });

  bill.paid = round((bill.paid || 0) + outstanding);
  bill.status = billStatus(bill);
  await bill.save();

  await audit(session, "payment.online", `Online payment ₹${outstanding} for ${bill.unitNumber} (${bill.period})`, {
    entity: "Bill",
    entityId: bill._id,
    meta: { amount: outstanding },
  });
  return ok({ payment, bill }, { status: 201 });
}
