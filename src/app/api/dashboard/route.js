import mongoose from "mongoose";
import { authorize, ok } from "@/lib/api";
import Unit from "@/models/Unit";
import Block from "@/models/Block";
import Bill from "@/models/Bill";
import Expense from "@/models/Expense";
import Loan from "@/models/Loan";
import WorkRequest from "@/models/WorkRequest";
import Reimbursement from "@/models/Reimbursement";
import Contract from "@/models/Contract";
import MaintenanceRequest from "@/models/MaintenanceRequest";
import { loanSummary, towerShares } from "@/lib/finance";

export async function GET() {
  const guard = await authorize("reports.dashboard");
  if (guard.error) return guard.error;
  const { session } = guard;
  // find() auto-casts, but aggregate() does NOT — match on a real ObjectId.
  const sid = new mongoose.Types.ObjectId(session.societyId);
  const scope = session.scopeBlocks?.length ? session.scopeBlocks : null;
  // block-bound matcher (Unit/Bill carry blockCode); plain matcher for the rest
  const f = (extra = {}) => ({ societyId: sid, ...(scope ? { blockCode: { $in: scope } } : {}), ...extra });
  const base = (extra = {}) => ({ societyId: sid, ...extra });

  const [units, blocks] = await Promise.all([
    Unit.countDocuments(f()),
    scope ? Promise.resolve(scope.length) : Block.countDocuments(base()),
  ]);

  const billAgg = await Bill.aggregate([
    { $match: f() },
    {
      $group: {
        _id: null,
        billed: { $sum: "$total" },
        collected: { $sum: "$paid" },
        count: { $sum: 1 },
      },
    },
  ]);
  const bills = billAgg[0] || { billed: 0, collected: 0, count: 0 };

  // approved expenses: scoped users see their tower's + society-common ones
  const expenseMatch = scope
    ? { societyId: sid, status: "approved", $or: [{ blockCode: { $in: scope } }, { blockCode: { $in: [null, ""] } }, { blockCode: { $exists: false } }] }
    : base({ status: "approved" });
  const expenseAgg = await Expense.aggregate([
    { $match: expenseMatch },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const overdueBills = await Bill.countDocuments(f({ status: "overdue" }));

  // loan exposure (computed, since outstanding isn't stored) — not block-bound
  const loans = await Loan.find(base({ status: "active" })).lean();
  const loanOutstanding = loans.reduce(
    (s, l) => s + loanSummary(l).outstanding,
    0
  );

  // block-wise billed totals
  const byBlock = await Bill.aggregate([
    { $match: f() },
    {
      $group: {
        _id: "$blockCode",
        billed: { $sum: "$total" },
        collected: { $sum: "$paid" },
        units: { $addToSet: "$unitId" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fund balances (billed-to-date) — MOFA sinking & repair reserves.
  const fundAgg = (await Bill.aggregate([
    { $match: f() },
    { $group: { _id: null, sinking: { $sum: "$sinkingFund" }, repair: { $sum: "$repairFund" }, gst: { $sum: "$gst" } } },
  ]))[0] || { sinking: 0, repair: 0, gst: 0 };

  // Pending approvals (work requests) + reimbursements awaiting action.
  const reqMatch = scope ? { societyId: sid, blockCode: { $in: scope }, status: { $in: ["pending_l1", "pending_l2"] } } : base({ status: { $in: ["pending_l1", "pending_l2"] } });
  const pendingApprovals = await WorkRequest.countDocuments(reqMatch);
  const pendingReimbursements = await Reimbursement.countDocuments(
    scope
      ? { societyId: sid, blockCode: { $in: scope }, status: { $in: ["submitted", "under_finance_review", "finance_approved", "chairman_approved"] } }
      : base({ status: { $in: ["submitted", "under_finance_review", "finance_approved", "chairman_approved"] } })
  );

  // Contracts expiring within 30 days.
  const soon = new Date(Date.now() + 30 * 86400000);
  const expiringContracts = await Contract.countDocuments(base({ renewalStatus: { $in: ["active", "up-for-renewal"] }, endDate: { $lte: soon } }));

  // Complaint resolution rate.
  const compMatch = scope ? { societyId: sid, blockCode: { $in: scope } } : base();
  const [compTotal, compResolved] = await Promise.all([
    MaintenanceRequest.countDocuments(compMatch),
    MaintenanceRequest.countDocuments({ ...compMatch, status: { $in: ["resolved", "closed"] } }),
  ]);

  // Tower-share table (proportional % of all-tower expenses).
  const allUnits = await Unit.find(base()).select("blockCode").lean();
  const shares = towerShares(allUnits);

  return ok({
    stats: {
      units,
      blocks,
      billsGenerated: bills.count,
      totalBilled: bills.billed,
      totalCollected: bills.collected,
      outstanding: bills.billed - bills.collected,
      approvedExpenses: expenseAgg[0]?.total || 0,
      overdueBills,
      loanOutstanding: Math.round(loanOutstanding),
      sinkingFund: Math.round(fundAgg.sinking),
      repairFund: Math.round(fundAgg.repair),
      gstLiability: Math.round(fundAgg.gst),
      pendingApprovals,
      pendingReimbursements,
      expiringContracts,
      complaintTotal: compTotal,
      complaintResolved: compResolved,
      complaintResolutionRate: compTotal ? Math.round((compResolved / compTotal) * 100) : 0,
    },
    byBlock: byBlock.map((b) => ({
      block: b._id || "—",
      billed: b.billed,
      collected: b.collected,
      units: b.units.length,
    })),
    towerShares: shares,
  });
}
