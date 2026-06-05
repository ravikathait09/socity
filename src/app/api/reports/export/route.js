import { authorize, tenantFilter, blockScopedFilter, bad } from "@/lib/api";
import { toCSV, csvResponse } from "@/lib/csv";
import { audit } from "@/lib/audit";
import Bill from "@/models/Bill";
import Payment from "@/models/Payment";
import Expense from "@/models/Expense";
import Vendor from "@/models/Vendor";
import Reimbursement from "@/models/Reimbursement";
import Contract from "@/models/Contract";
import MaintenanceRequest from "@/models/MaintenanceRequest";

// CSV export (Excel/Sheets compatible). ?type=bills|payments|expenses&period=YYYY-MM
export async function GET(req) {
  const guard = await authorize("reports.export");
  if (guard.error) return guard.error;
  const { session } = guard;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "bills";
  const period = url.searchParams.get("period");
  // bills & payments carry blockCode → tower-scope them; expenses handled below
  const f = (extra = {}) => blockScopedFilter(session, { ...(period ? { period } : {}), ...extra });

  let csv, filename;
  if (type === "bills") {
    const rows = await Bill.find(f()).sort({ unitNumber: 1 }).lean();
    csv = toCSV(rows, [
      { label: "Unit", key: "unitNumber" },
      { label: "Block", key: "blockCode" },
      { label: "Period", key: "period" },
      { label: "Maintenance", key: "serviceCharge" },
      { label: "Sinking fund", key: "sinkingFund" },
      { label: "Repair fund", key: "repairFund" },
      { label: "Water", key: "waterCharge" },
      { label: "Common charge", key: "commonCharge" },
      { label: "GST", key: "gst" },
      { label: "Interest", key: "interest" },
      { label: "Penalty", key: "penalty" },
      { label: "Total", key: "total" },
      { label: "Paid", key: "paid" },
      { label: "Status", key: "status" },
    ]);
    filename = `bills-${period || "all"}.csv`;
  } else if (type === "payments") {
    const rows = await Payment.find(f()).sort({ paidAt: -1 }).lean();
    csv = toCSV(rows, [
      { label: "Date", value: (r) => new Date(r.paidAt).toISOString() },
      { label: "Period", key: "period" },
      { label: "Amount", key: "amount" },
      { label: "Method", key: "method" },
      { label: "Reference", key: "reference" },
    ]);
    filename = `payments-${period || "all"}.csv`;
  } else if (type === "expenses") {
    // expenses: scoped users get their tower's + society-common (no blockCode)
    let expFilter = tenantFilter(session, { ...(period ? { period } : {}) });
    if (session.scopeBlocks?.length) {
      expFilter.$or = [
        { blockCode: { $in: session.scopeBlocks } },
        { blockCode: { $in: [null, ""] } },
        { blockCode: { $exists: false } },
      ];
    }
    const rows = await Expense.find(expFilter).sort({ createdAt: -1 }).lean();
    csv = toCSV(rows, [
      { label: "Category", key: "category" },
      { label: "Period", key: "period" },
      { label: "Amount", key: "amount" },
      { label: "Split rule", key: "splitRule" },
      { label: "Block", key: "blockCode" },
      { label: "Status", key: "status" },
    ]);
    filename = `expenses-${period || "all"}.csv`;
  } else if (type === "vendors") {
    const rows = await Vendor.find(tenantFilter(session)).sort({ name: 1 }).lean();
    csv = toCSV(rows, [
      { label: "Code", key: "code" },
      { label: "Name", key: "name" },
      { label: "Category", key: "serviceCategory" },
      { label: "Contact", key: "contactPerson" },
      { label: "Phone", key: "phone" },
      { label: "GSTIN", key: "gstNumber" },
      { label: "PAN", key: "pan" },
      { label: "In-charge", key: "inChargeName" },
      { label: "Rating", key: "rating" },
      { label: "Paid this FY", key: "paidThisFY" },
      { label: "Blacklisted", value: (r) => (r.blacklisted ? "yes" : "no") },
    ]);
    filename = "vendor-register.csv";
  } else if (type === "contracts") {
    const rows = await Contract.find(tenantFilter(session)).select("-document.contentBase64").sort({ endDate: 1 }).lean();
    csv = toCSV(rows, [
      { label: "Contract", key: "contractNo" },
      { label: "Vendor", key: "vendorName" },
      { label: "Type", key: "contractType" },
      { label: "Value", key: "value" },
      { label: "Start", value: (r) => (r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : "") },
      { label: "End", value: (r) => (r.endDate ? new Date(r.endDate).toISOString().slice(0, 10) : "") },
      { label: "Status", key: "renewalStatus" },
      { label: "In-charge", key: "inChargeName" },
    ]);
    filename = "contracts.csv";
  } else if (type === "reimbursements") {
    const rows = await Reimbursement.find(blockScopedFilter(session)).select("-receipt.contentBase64").sort({ createdAt: -1 }).lean();
    csv = toCSV(rows, [
      { label: "Code", key: "code" },
      { label: "Requested by", key: "requestedByName" },
      { label: "Date", value: (r) => (r.dateOfExpense ? new Date(r.dateOfExpense).toISOString().slice(0, 10) : "") },
      { label: "Category", key: "category" },
      { label: "Amount", key: "amount" },
      { label: "Tower", key: "blockCode" },
      { label: "Status", key: "status" },
      { label: "Payment ref", key: "paymentRef" },
    ]);
    filename = "reimbursements.csv";
  } else if (type === "complaints") {
    const rows = await MaintenanceRequest.find(blockScopedFilter(session)).select("-photo.contentBase64").sort({ createdAt: -1 }).lean();
    csv = toCSV(rows, [
      { label: "WO", key: "code" },
      { label: "Title", key: "title" },
      { label: "Category", key: "category" },
      { label: "Priority", key: "priority" },
      { label: "Raised by", key: "raisedByName" },
      { label: "Tower", key: "blockCode" },
      { label: "Status", key: "status" },
      { label: "Assigned to", key: "assignedToName" },
      { label: "SLA breached", value: (r) => (r.slaBreached ? "yes" : "no") },
      { label: "Rating", key: "satisfactionRating" },
      { label: "Raised", value: (r) => new Date(r.createdAt).toISOString().slice(0, 10) },
      { label: "Resolved", value: (r) => (r.resolvedAt ? new Date(r.resolvedAt).toISOString().slice(0, 10) : "") },
    ]);
    filename = "complaint-resolution.csv";
  } else {
    return bad("Unknown export type");
  }

  await audit(session, "report.export", `Exported ${type} report (${period || "all"})`, {
    entity: "Report",
    meta: { type, period },
  });
  return csvResponse(csv, filename);
}
