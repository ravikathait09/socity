"use client";
import { useEffect, useState } from "react";
import { currentPeriod } from "@/lib/period";

function money(n) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function BillingPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [bills, setBills] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch(`/api/bills?period=${period}`).then((x) => x.json());
    if (r.bills) setBills(r.bills);
  }
  useEffect(() => {
    load();
  }, [period]);

  async function generate() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/bills/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(data.error || "Failed");
    setMsg(`Generated ${data.result.created} bills from ${data.result.expenses} expenses.`);
    load();
  }

  const total = bills.reduce((s, b) => s + b.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="text-sm text-slate-500">
            Monthly bills = electricity (units × rate) + pro-rated common expenses.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="label">Period</label>
            <input className="input w-32" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "Generate bills"}
          </button>
        </div>
      </div>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}

      <div className="card p-4">
        <span className="text-sm text-slate-500">Total billed for {period}: </span>
        <span className="text-lg font-semibold">{money(total)}</span>
        <span className="ml-2 text-sm text-slate-400">({bills.length} units)</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Unit</th>
              <th>Block</th>
              <th>Power units</th>
              <th>Power ₹</th>
              <th>Common ₹</th>
              <th>Total ₹</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b._id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{b.unitNumber}</td>
                <td>{b.blockCode || "—"}</td>
                <td>{b.powerUnits}</td>
                <td>{money(b.powerCharge)}</td>
                <td>{money(b.commonCharge)}</td>
                <td className="font-semibold">{money(b.total)}</td>
                <td>
                  <span className="badge bg-amber-100 text-amber-700">{b.status}</span>
                </td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No bills for {period}. Click “Generate bills”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
