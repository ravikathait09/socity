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
  const [selected, setSelected] = useState(new Set()); // bill ids picked for bulk settle
  const [settle, setSettle] = useState(null); // { mode, bill?, ids?, amount, count } for the method popup
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("unpaid"); // default to showing unpaid
  const [allPeriods, setAllPeriods] = useState(false);

  async function load() {
    const q = allPeriods ? "" : period;
    const [b, p] = await Promise.all([
      fetch(`/api/bills?period=${q}`).then((r) => r.json()),
      fetch(`/api/payments?period=${q}`).then((r) => r.json()),
    ]);
    if (b.bills) setBills(b.bills);
    if (p.payments) setPayments(p.payments);
  }
  useEffect(() => {
    load();
  }, [period, allPeriods]);

  // apply search + status filter
  const visible = bills.filter((b) => {
    const due = b.total - b.paid;
    if (search && !(b.unitNumber || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === "unpaid") return due > 0;
    if (statusFilter === "paid") return b.status === "paid";
    if (statusFilter === "overdue") return b.status === "overdue";
    if (statusFilter === "partial") return b.status === "partial";
    return true; // "all"
  });

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

  // currently-visible bills that still have something due (eligible for bulk settle)
  const dueBills = visible.filter((b) => b.total - b.paid > 0);

  function toggle(id) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) => (s.size === dueBills.length ? new Set() : new Set(dueBills.map((b) => b._id))));
  }

  // Open the "which method?" popup for a single bill or the selected batch.
  function openSettle(target) {
    if (target === "bulk") {
      const ids = [...selected];
      if (ids.length === 0) return;
      const sum = bills.filter((b) => selected.has(b._id)).reduce((s, b) => s + (b.total - b.paid), 0);
      setSettle({ mode: "bulk", ids, amount: sum, count: ids.length });
    } else {
      const due = target.total - target.paid;
      if (due <= 0) return;
      setSettle({ mode: "single", bill: target, amount: due, count: 1 });
    }
  }

  // Record using the chosen method (+ optional reference for a single bill).
  async function doSettle(method, reference) {
    setMsg("");
    let res, d;
    if (settle.mode === "single") {
      res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId: settle.bill._id, amount: settle.amount, method, reference }),
      });
      d = await res.json();
      setMsg(res.ok ? `Recorded ${money(settle.amount)} for ${settle.bill.unitNumber} (${method}).` : (d.error || "Failed"));
    } else {
      res = await fetch("/api/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billIds: settle.ids, method, reference }),
      });
      d = await res.json();
      setSelected(new Set());
      setMsg(res.ok ? `Settled ${d.settled} bills (${money(d.total)}) via ${method}${d.skipped ? `, skipped ${d.skipped}` : ""}.` : (d.error || "Failed"));
    }
    setSettle(null);
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
            <input className="input w-32" value={period} disabled={allPeriods} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <button className="btn-ghost" onClick={runPenalties} disabled={allPeriods} title={allPeriods ? "Pick a period to run late fees" : ""}>
            Apply late fees
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Search unit</label>
          <input className="input w-44" placeholder="e.g. A-101" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <label className="label">Show</label>
          <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="unpaid">Unpaid (has dues)</option>
            <option value="overdue">Overdue</option>
            <option value="partial">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="all">All</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={allPeriods} onChange={(e) => setAllPeriods(e.target.checked)} /> All periods
        </label>
        <span className="pb-2 text-sm text-slate-400">{visible.length} shown</span>
      </div>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <span>
          <span className="text-sm text-slate-500">Outstanding dues for {period}: </span>
          <span className="text-lg font-semibold">{money(outstanding)}</span>
        </span>
        {selected.size > 0 && (
          <button className="btn-primary text-sm" onClick={() => openSettle("bulk")}>
            Mark {selected.size} selected paid…
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2 w-8">
                <input
                  type="checkbox"
                  checked={dueBills.length > 0 && selected.size === dueBills.length}
                  onChange={toggleAll}
                  title="Select all unpaid"
                />
              </th>
              <th>Unit</th>
              <th>Period</th>
              <th>Total</th>
              <th>Penalty</th>
              <th>Paid</th>
              <th>Due</th>
              <th>Status</th>
              <th className="text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((b) => {
              const due = b.total - b.paid;
              return (
                <tr key={b._id} className={`border-t border-slate-100 ${selected.has(b._id) ? "bg-brand-50/40" : ""}`}>
                  <td className="px-4 py-2">
                    {due > 0 ? (
                      <input type="checkbox" checked={selected.has(b._id)} onChange={() => toggle(b._id)} />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="font-medium">{b.unitNumber}</td>
                  <td className="text-slate-500">{b.period}</td>
                  <td>{money(b.total)}</td>
                  <td>{b.penalty ? money(b.penalty) : "—"}</td>
                  <td>{money(b.paid)}</td>
                  <td className={due > 0 ? "font-medium text-red-600" : "text-slate-400"}>{money(due)}</td>
                  <td>
                    <span className={`badge ${STATUS_STYLE[b.status] || ""}`}>{b.status}</span>
                  </td>
                  <td className="pr-4 text-right">
                    <div className="flex justify-end gap-2">
                      {due > 0 && (
                        <button className="btn-ghost text-xs text-green-700" onClick={() => openSettle(b)}>Mark paid</button>
                      )}
                      <button className="btn-ghost text-xs" onClick={() => setActive(b)}>Manage</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                  {bills.length === 0 ? `No bills for ${allPeriods ? "any period" : period}.` : "No bills match this filter."}
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

      {settle && (
        <SettleModal settle={settle} onClose={() => setSettle(null)} onConfirm={doSettle} />
      )}
    </div>
  );
}

// Method picker for marking a bill (or batch) paid.
function SettleModal({ settle, onClose, onConfirm }) {
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const isBulk = settle.mode === "bulk";
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Record payment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          {isBulk ? `${settle.count} bills` : settle.bill.unitNumber} · settling{" "}
          <b>{money(settle.amount)}</b> in full.
        </p>
        <label className="label">Payment method</label>
        <select className="input mb-3" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="bank">Bank transfer</option>
          <option value="cheque">Cheque</option>
        </select>
        {!isBulk && (
          <>
            <label className="label">Reference / UTR <span className="font-normal text-slate-400">(optional)</span></label>
            <input className="input mb-3" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="txn / cheque no." />
          </>
        )}
        {isBulk && (
          <p className="mb-3 text-xs text-slate-400">All {settle.count} receipts get this method. For individual reference numbers, use Manage per flat.</p>
        )}
        <button className="btn-primary w-full" onClick={() => onConfirm(method, reference || undefined)}>
          Confirm {money(settle.amount)} · {method}
        </button>
      </div>
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
