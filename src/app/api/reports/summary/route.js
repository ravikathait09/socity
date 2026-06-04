import mongoose from "mongoose";
import { authorize, ok } from "@/lib/api";
import Bill from "@/models/Bill";
import Expense from "@/models/Expense";

// Period-level analytics for the reports page: collection efficiency, status mix
// and block-wise breakdown. Gated by reports.block.
export async function GET(req) {
  const guard = await authorize("reports.block");
  if (guard.error) return guard.error;
  const sid = new mongoose.Types.ObjectId(guard.session.societyId);
  const period = new URL(req.url).searchParams.get("period");
  const scope = guard.session.scopeBlocks?.length ? guard.session.scopeBlocks : null;
  // bills carry blockCode → scope them directly
  const match = { societyId: sid, ...(period ? { period } : {}), ...(scope ? { blockCode: { $in: scope } } : {}) };

  const totals = (
    await Bill.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          billed: { $sum: "$total" },
          collected: { $sum: "$paid" },
          penalty: { $sum: "$penalty" },
          gst: { $sum: "$gst" },
          sinkingFund: { $sum: "$sinkingFund" },
          repairFund: { $sum: "$repairFund" },
          interest: { $sum: "$interest" },
          count: { $sum: 1 },
        },
      },
    ])
  )[0] || { billed: 0, collected: 0, penalty: 0, gst: 0, sinkingFund: 0, repairFund: 0, interest: 0, count: 0 };

  const byStatus = await Bill.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 }, due: { $sum: { $subtract: ["$total", "$paid"] } } } },
  ]);

  const byBlock = await Bill.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$blockCode",
        billed: { $sum: "$total" },
        collected: { $sum: "$paid" },
        units: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // approved expenses: scoped users see their tower's + society-common ones
  const expenseMatch = scope
    ? { societyId: sid, ...(period ? { period } : {}), status: "approved", $or: [{ blockCode: { $in: scope } }, { blockCode: { $in: [null, ""] } }, { blockCode: { $exists: false } }] }
    : { societyId: sid, ...(period ? { period } : {}), status: "approved" };
  const expenseTotal = (
    await Expense.aggregate([
      { $match: expenseMatch },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])
  )[0]?.total || 0;

  const efficiency = totals.billed > 0 ? Math.round((totals.collected / totals.billed) * 100) : 0;

  return ok({
    period: period || "all",
    totals: { ...totals, outstanding: totals.billed - totals.collected, efficiency, expenseTotal },
    byStatus: byStatus.map((s) => ({ status: s._id || "—", count: s.count, due: s.due })),
    byBlock: byBlock.map((b) => ({ block: b._id || "—", ...b, _id: undefined })),
  });
}
