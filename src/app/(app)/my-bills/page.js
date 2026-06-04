"use client";
import { useEffect, useState } from "react";

function money(n) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
const STATUS_STYLE = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
};

export default function MyBillsPage() {
  const [bills, setBills] = useState([]);
  const [err, setErr] = useState("");
  const [paying, setPaying] = useState(null);
  const [msg, setMsg] = useState("");

  function load() {
    fetch("/api/bills")
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setBills(d.bills)))
      .catch((e) => setErr(String(e)));
  }
  useEffect(() => {
    load();
  }, []);

  async function payOnline(billId) {
    setPaying(billId);
    setMsg("");
    const res = await fetch("/api/payments/online", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billId }),
    });
    const d = await res.json();
    setPaying(null);
    if (!res.ok) return setMsg(d.error || "Payment failed");
    setMsg(`Paid ${money(d.payment.amount)} · ref ${d.payment.reference}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My bills</h1>
        <p className="text-sm text-slate-500">Bills for your unit only — tenant-isolated.</p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}

      <div className="space-y-4">
        {bills.map((b) => {
          const due = b.total - b.paid;
          return (
            <div key={b._id} className="card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-400">{b.period}</div>
                  <div className="text-lg font-semibold">{b.unitNumber}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold">{money(b.total)}</div>
                  <span className={`badge ${STATUS_STYLE[b.status] || ""}`}>{b.status}</span>
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-3">
                {(b.lineItems || []).map((li, i) => (
                  <div key={i} className="flex justify-between py-1 text-sm">
                    <span className="text-slate-600">{li.label}</span>
                    <span>{money(li.amount)}</span>
                  </div>
                ))}
                {b.penalty > 0 && (
                  <div className="flex justify-between py-1 text-sm text-red-600">
                    <span>Late penalty</span>
                    <span>{money(b.penalty)}</span>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  {due > 0 ? `Due: ${money(due)}` : "Settled"}
                </span>
                <button
                  className="btn-primary text-sm"
                  disabled={due <= 0 || paying === b._id}
                  onClick={() => payOnline(b._id)}
                >
                  {paying === b._id ? "Processing…" : due > 0 ? `Pay ${money(due)} online` : "Paid"}
                </button>
              </div>
            </div>
          );
        })}
        {bills.length === 0 && !err && (
          <p className="text-sm text-slate-400">No bills yet for your unit.</p>
        )}
      </div>
    </div>
  );
}
