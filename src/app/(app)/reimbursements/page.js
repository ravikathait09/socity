"use client";
import { useEffect, useState } from "react";
import { hasPermission } from "@/lib/rbac";

const STATUS_STYLE = {
  submitted: "bg-amber-100 text-amber-700",
  under_finance_review: "bg-blue-100 text-blue-700",
  finance_approved: "bg-indigo-100 text-indigo-700",
  chairman_approved: "bg-purple-100 text-purple-700",
  payment_processed: "bg-teal-100 text-teal-700",
  closed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-slate-200 text-slate-500",
};
function money(n) { return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }
function readFile(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}
const BLANK = { dateOfExpense: "", category: "", description: "", amount: "", vendorPayee: "", paymentModeUsed: "cash", requesterBankUpi: "", notes: "", blockCode: "" };

export default function ReimbursementsPage() {
  const [list, setList] = useState([]);
  const [perms, setPerms] = useState([]);
  const [uid, setUid] = useState("");
  const [form, setForm] = useState(BLANK);
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");

  const canRaise = hasPermission(perms, "reimburse.raise");
  const canReview = hasPermission(perms, "reimburse.review");
  const canApprove = hasPermission(perms, "reimburse.approve");
  const canPay = hasPermission(perms, "reimburse.pay");

  async function load() {
    const [d, me] = await Promise.all([
      fetch("/api/reimbursements").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ]);
    if (d.reimbursements) setList(d.reimbursements);
    if (me.session) { setPerms(me.session.permissions || []); setUid(me.session.uid); }
  }
  useEffect(() => { load(); }, []);

  async function submit(e, confirmDuplicate = false) {
    e?.preventDefault?.();
    setErr("");
    if (!file) return setErr("A bill/receipt is mandatory");
    const receipt = { name: file.name, mimeType: file.type, contentBase64: await readFile(file) };
    const res = await fetch("/api/reimbursements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount), receipt, confirmDuplicate }),
    });
    const d = await res.json();
    if (res.status === 409 && !confirmDuplicate) {
      if (confirm(d.error + "\n\nSubmit anyway?")) return submit(null, true);
      return;
    }
    if (!res.ok) return setErr(d.error || "Failed");
    setForm(BLANK); setFile(null);
    e?.target?.reset?.();
    load();
  }

  async function act(id, action, extra = {}) {
    if (action.endsWith("reject")) {
      const note = prompt("Rejection reason (required):");
      if (!note) return;
      extra.note = note;
    }
    if (action === "pay") {
      const paymentRef = prompt("Payment reference / UTR (required):");
      if (!paymentRef) return;
      extra.paymentRef = paymentRef;
    }
    if (action === "finance_approve") {
      extra.remark = prompt("Finance remark (optional):") || undefined;
    }
    await fetch(`/api/reimbursements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    load();
  }

  function actionsFor(r) {
    const mine = String(r.requestedById) === String(uid);
    const btns = [];
    if (canReview && ["submitted", "under_finance_review"].includes(r.status)) {
      btns.push(["finance_approve", "Finance approve", ""]);
      btns.push(["finance_reject", "Reject", "text-red-600"]);
    }
    if (canApprove && r.status === "finance_approved") {
      btns.push(["chairman_approve", "Chairman approve", ""]);
      btns.push(["chairman_reject", "Reject", "text-red-600"]);
    }
    if (canPay && r.status === "chairman_approved") btns.push(["pay", "Mark paid", ""]);
    if (mine && r.status === "payment_processed") btns.push(["close", "Confirm received", ""]);
    if (mine && ["submitted", "under_finance_review", "finance_approved"].includes(r.status)) btns.push(["cancel", "Cancel", "text-slate-500"]);
    return btns;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reimbursements</h1>
        <p className="text-sm text-slate-500">
          Claim money you spent for society work. Flow: Finance review → Chairman approval → payout → you confirm receipt.
        </p>
      </div>

      {canRaise && (
        <form onSubmit={submit} className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-6">
          <div>
            <label className="label">Date of expense</label>
            <input type="date" className="input" value={form.dateOfExpense} onChange={(e) => setForm({ ...form, dateOfExpense: e.target.value })} />
          </div>
          <div>
            <label className="label">Category</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Plumbing supplies" />
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Paid to</label>
            <input className="input" value={form.vendorPayee} onChange={(e) => setForm({ ...form, vendorPayee: e.target.value })} />
          </div>
          <div>
            <label className="label">Paid via</label>
            <select className="input" value={form.paymentModeUsed} onChange={(e) => setForm({ ...form, paymentModeUsed: e.target.value })}>
              <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option>
            </select>
          </div>
          <div>
            <label className="label">Your bank / UPI</label>
            <input className="input" value={form.requesterBankUpi} onChange={(e) => setForm({ ...form, requesterBankUpi: e.target.value })} placeholder="name@upi" />
          </div>
          <div className="col-span-2 md:col-span-3">
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="label">Receipt (required)</label>
            <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="col-span-2 md:col-span-6">
            <button className="btn-primary">Submit claim</button>
            {err && <span className="ml-3 text-sm text-red-600">{err}</span>}
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Code</th>
              <th>By</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Receipt</th>
              <th>Status</th>
              <th className="pr-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r._id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2 font-mono text-xs">{r.code}{r.overLimit && <span className="ml-1 badge bg-orange-100 text-orange-700">over-limit</span>}</td>
                <td className="text-slate-500">{r.requestedByName}</td>
                <td>
                  <div className="font-medium">{r.description}</div>
                  <div className="text-xs text-slate-400">{r.category}{r.vendorPayee ? ` · ${r.vendorPayee}` : ""}</div>
                  {r.financeRemark && <div className="text-xs text-blue-600">Finance: {r.financeRemark}</div>}
                  {r.rejectedReason && <div className="text-xs text-red-600">Rejected ({r.rejectedStage}): {r.rejectedReason}</div>}
                  {r.paymentRef && <div className="text-xs text-teal-600">Paid · ref {r.paymentRef}</div>}
                </td>
                <td>{money(r.amount)}</td>
                <td><a className="text-brand-600 hover:underline" href={`/api/reimbursements/${r._id}/receipt`} target="_blank" rel="noreferrer">📎 view</a></td>
                <td><span className={`badge ${STATUS_STYLE[r.status] || ""}`}>{r.status.replace(/_/g, " ")}</span></td>
                <td className="pr-4 text-right">
                  <div className="flex flex-col items-end gap-1">
                    {actionsFor(r).map(([action, label, cls]) => (
                      <button key={action} className={`btn-ghost text-xs ${cls}`} onClick={() => act(r._id, action)}>{label}</button>
                    ))}
                    {actionsFor(r).length === 0 && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No reimbursement claims yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
