import { NextResponse } from "next/server";
import { requireSession, tenantFilter, ownedUnitIds, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import Payment from "@/models/Payment";
import Bill from "@/models/Bill";
import Society from "@/models/Society";
import User from "@/models/User";

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
const money = (n) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

// A printable HTML payment receipt. The resident can open it for their OWN unit's
// payments; finance staff (payments.record) can open any. Print → Save as PDF.
export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const { id } = await params;
  const payment = await Payment.findOne(tenantFilter(session, { _id: id })).lean();
  if (!payment) return bad("Payment not found", 404);

  const canSeeAll = hasPermission(session.permissions, "payments.record");
  if (!canSeeAll) {
    const me = await User.findById(session.uid).lean();
    if (!ownedUnitIds(me).includes(String(payment.unitId)))
      return bad("Forbidden", 403);
  }

  const [society, bill] = await Promise.all([
    Society.findById(session.societyId).lean(),
    payment.billId ? Bill.findById(payment.billId).lean() : null,
  ]);

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Receipt ${esc(payment.reference || payment._id)}</title>
<style>
 body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:640px;margin:40px auto;padding:0 20px}
 h1{color:#1F4E79;margin:0 0 4px} .muted{color:#6b7280;font-size:13px}
 table{width:100%;border-collapse:collapse;margin-top:18px} td{padding:8px 4px;border-bottom:1px solid #eee;font-size:14px}
 td.l{color:#6b7280} td.r{text-align:right;font-weight:600}
 .amt{font-size:26px;font-weight:700;color:#1F4E79;margin-top:6px}
 .box{border:1px solid #e5e7eb;border-radius:10px;padding:18px;margin-top:18px}
 @media print{button{display:none}}
</style></head><body>
 <h1>${esc(society?.name || "Society")}</h1>
 <div class="muted">${esc(society?.address || "")} ${society?.registrationNo ? "· Reg. " + esc(society.registrationNo) : ""}</div>
 <div class="box">
   <div class="muted">PAYMENT RECEIPT</div>
   <div class="amt">${money(payment.amount)}</div>
   <table>
     <tr><td class="l">Receipt no.</td><td class="r">${esc(payment.reference || String(payment._id).slice(-8))}</td></tr>
     <tr><td class="l">Date</td><td class="r">${new Date(payment.paidAt).toLocaleString("en-IN")}</td></tr>
     <tr><td class="l">Unit</td><td class="r">${esc(bill?.unitNumber || "")}</td></tr>
     <tr><td class="l">Billing period</td><td class="r">${esc(payment.period || "")}</td></tr>
     <tr><td class="l">Method</td><td class="r">${esc(payment.method)}</td></tr>
     ${bill ? `<tr><td class="l">Bill total</td><td class="r">${money(bill.total)}</td></tr>
     <tr><td class="l">Bill outstanding after</td><td class="r">${money((bill.total || 0) - (bill.paid || 0))}</td></tr>` : ""}
   </table>
 </div>
 <p class="muted" style="margin-top:24px">This is a system-generated receipt and does not require a signature.</p>
 <button onclick="window.print()" style="margin-top:10px;padding:8px 16px;background:#1F4E79;color:#fff;border:none;border-radius:8px;cursor:pointer">Print / Save as PDF</button>
</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
