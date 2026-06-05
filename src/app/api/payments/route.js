import { authorize, requireSession, tenantFilter, blockScopedFilter, isBlockScoped, ownedUnitIds, ok, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { billStatus, round } from "@/lib/finance";
import { audit } from "@/lib/audit";
import Payment from "@/models/Payment";
import Bill from "@/models/Bill";
import User from "@/models/User";

// List receipts. Finance roles see all (within tower scope); residents see only
// their own unit's.
export async function GET(req) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const url = new URL(req.url);
  const period = url.searchParams.get("period");

  // "mine" — always scope to the caller's own flat(s), regardless of role.
  if (url.searchParams.get("mine")) {
    const me = await User.findById(session.uid).lean();
    const ids = ownedUnitIds(me);
    if (ids.length === 0) return ok({ payments: [] });
    const f = tenantFilter(session, { unitId: { $in: ids } });
    const payments = await Payment.find(f).sort({ paidAt: -1 }).lean();
    return ok({ payments });
  }

  const canSeeAll = hasPermission(session.permissions, "payments.record");
  let filter = blockScopedFilter(session, period ? { period } : {});
  if (!canSeeAll) {
    if (!hasPermission(session.permissions, "payments.pay_online"))
      return bad("Forbidden", 403);
    const me = await User.findById(session.uid).lean();
    const ids = ownedUnitIds(me);
    if (ids.length === 0) return ok({ payments: [] });
    filter = tenantFilter(session, { unitId: { $in: ids } });
  }
  const payments = await Payment.find(filter).sort({ paidAt: -1 }).lean();
  return ok({ payments });
}

// Record a payment receipt against a bill (treasurer / accountant).
export async function POST(req) {
  const guard = await authorize("payments.record");
  if (guard.error) return guard.error;
  const { session } = guard;
  const b = await req.json().catch(() => ({}));
  if (!b.billId || !b.amount) return bad("billId and amount are required");
  const amount = round(Number(b.amount));
  if (amount <= 0) return bad("amount must be positive");

  const bill = await Bill.findOne(tenantFilter(session, { _id: b.billId }));
  if (!bill) return bad("Bill not found", 404);
  if (isBlockScoped(session) && !session.scopeBlocks.includes(bill.blockCode))
    return bad("This bill is outside your assigned tower(s)", 403);

  const payment = await Payment.create({
    societyId: session.societyId,
    billId: bill._id,
    unitId: bill.unitId,
    blockCode: bill.blockCode,
    period: bill.period,
    amount,
    method: b.method || "cash",
    reference: b.reference,
    receivedBy: session.uid,
  });

  bill.paid = round((bill.paid || 0) + amount);
  bill.status = billStatus(bill);
  await bill.save();

  await audit(session, "payment.record", `Recorded ${b.method || "cash"} payment ₹${amount} for ${bill.unitNumber} (${bill.period})`, {
    entity: "Bill",
    entityId: bill._id,
    meta: { amount, method: b.method || "cash" },
  });
  return ok({ payment, bill }, { status: 201 });
}
