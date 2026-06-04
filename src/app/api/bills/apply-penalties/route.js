import mongoose from "mongoose";
import { authorize, ok, bad } from "@/lib/api";
import { computePenalty, billStatus, round } from "@/lib/finance";
import { audit } from "@/lib/audit";
import Bill from "@/models/Bill";
import Society from "@/models/Society";

// Bulk late-fee run: for a period, find bills past their due date that are still
// unpaid/partial and add a late penalty to each (idempotent-ish — only bills with
// outstanding dues and no penalty yet are charged).  (treasurer / society admin)
export async function POST(req) {
  const guard = await authorize("billing.penalty");
  if (guard.error) return guard.error;
  const { period, pct, min } = await req.json().catch(() => ({}));
  if (!period) return bad("period is required");

  const sid = new mongoose.Types.ObjectId(guard.session.societyId);
  const now = new Date();
  // default penalty params come from the society's settings (request can override)
  const society = await Society.findById(guard.session.societyId).lean();
  const effPct = pct ?? society?.settings?.penaltyPct ?? 2;
  const effMin = min ?? society?.settings?.penaltyMin ?? 100;
  const match = { societyId: sid, period };
  if (guard.session.scopeBlocks?.length) match.blockCode = { $in: guard.session.scopeBlocks };
  const bills = await Bill.find(match);

  let charged = 0;
  let totalPenalty = 0;
  for (const bill of bills) {
    const outstanding = round((bill.total || 0) - (bill.paid || 0));
    const overdue = bill.dueDate && now > new Date(bill.dueDate);
    if (!overdue || outstanding <= 0 || (bill.penalty || 0) > 0) continue;

    const penalty = computePenalty(outstanding, { pct: effPct, min: effMin });
    bill.penalty = round((bill.penalty || 0) + penalty);
    bill.total = round((bill.total || 0) + penalty);
    bill.status = billStatus(bill, now);
    await bill.save();
    charged++;
    totalPenalty = round(totalPenalty + penalty);
  }

  await audit(guard.session, "bill.late_fees", `Applied late fees to ${charged} bills (₹${totalPenalty}) for ${period}`, {
    entity: "Bill",
    meta: { period, charged, totalPenalty },
  });
  return ok({ charged, totalPenalty });
}
