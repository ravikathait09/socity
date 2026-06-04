"use client";
import { useEffect, useState } from "react";
import { currentPeriod } from "@/lib/period";

function money(n) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
const STATUS_STYLE = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
};

export default function PaymentsPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [bills, setBills] = useState([]);
  const [payments, setPayments] = useState([]);
  const [active, setActive] = useState(null); // bill being acted on
  const [msg, setMsg] = useState("");

  async function load() {
    const [b, p] = await Promise.all([
      fetch(`/api/bills?period=${period}`).then((r) => r.json()),
      fetch(`/api/payments?period=${period}`).then((r) => r.json()),
    ]);
    if (b.bills) setBills(b.bills);
    if (p.payments) setPayments(p.payments);
  }
  useEffect(() => {
    load();
  }, [period]);

  async function runPenalties() {
    setMsg("");
    const res = await fetch("/api/bills/apply-penalties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    });
    const d = await res.json();
    setMsg(res.ok ? `Late fee applied to ${d.charged} bills (${money(d.totalPenalty)}).` : d.error);
    load();
  }

  const outstanding = bills.reduce((s, b) => s + (b.total - b.paid), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payments & dues</h1>
          <p className="text-sm text-slate-500">Record receipts, apply penalties/waivers, run late fees.</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="label">Period</label>
            <input className="input w-32" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <button className="btn-ghost" onClick={runPenalties}>
            Apply late fees
          </button>
        </div>
      </div>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}

      <div className="card p-4">
        <span className="text-sm text-slate-500">Outstanding dues for {period}: </span>
        <span className="text-lg font-semibold">{money(outstanding)}</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Unit</th>
              <th>Total</th>
              <th>Penalty</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => {
              const due = b.total - b.paid;
              return (
                <tr key={b._id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{b.unitNumber}</td>
                  <td>{money(b.total)}</td>
                  <td>{b.penalty ? money(b.penalty) : "—"}</td>
                  <td>{money(b.paid)}</td>
                  <td className={due > 0 ? "font-medium text-red-600" : "text-slate-400"}>{money(due)}</td>
                  <td>
                    <span className={`badge ${STATUS_STYLE[b.status] || ""}`}>{b.status}</span>
                  </td>
                  <td className="pr-4 text-right">
                    <button className="btn-ghost text-xs" onClick={() => setActive(b)}>
                      Manage
                    </button>
                  </td>
                </tr>
              );
            })}
            {bills.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No bills for {period}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Recent receipts</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2">When</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{new Date(p.paidAt).toLocaleString()}</td>
                  <td>{money(p.amount)}</td>
                  <td>{p.method}</td>
                  <td className="text-slate-500">{p.reference || "—"}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    No receipts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {active && (
        <ManageModal
          bill={active}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ManageModal({ bill, onClose, onDone }) {
  const due = bill.total - bill.paid;
  const [amount, setAmount] = useState(due > 0 ? due : "");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [penaltyAmt, setPenaltyAmt] = useState("");
  const [err, setErr] = useState("");

  async function recordPayment() {
    setErr("");
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billId: bill._id, amount: Number(amount), method, reference }),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    onDone();
  }

  async function applyPenalty(type) {
    setErr("");
    const res = await fetch(`/api/bills/${bill._id}/penalty`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(penaltyAmt), type }),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    onDone();
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{bill.unitNumber} · {bill.period}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Total {money(bill.total)} · Paid {money(bill.paid)} · Due <b>{money(due)}</b>
        </p>

        <div className="mb-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Record payment</div>
          <div className="grid grid-cols-3 gap-2">
            <input className="input" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank</option>
              <option value="cheque">Cheque</option>
            </select>
            <input className="input" placeholder="Ref." value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <button className="btn-primary mt-2 w-full" onClick={recordPayment}>Record payment</button>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Penalty / waiver</div>
          <div className="flex gap-2">
            <input className="input" placeholder="Amount" value={penaltyAmt} onChange={(e) => setPenaltyAmt(e.target.value)} />
            <button className="btn-ghost" onClick={() => applyPenalty("penalty")}>Add penalty</button>
            <button className="btn-ghost" onClick={() => applyPenalty("waiver")}>Waive</button>
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </div>
    </div>
  );
}
