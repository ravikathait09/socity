"use client";
import { useEffect, useState } from "react";
import { currentPeriod } from "@/lib/period";

function money(n) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
const STATUS_STYLE = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-blue-100 text-blue-700",
  overdue: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
};

export default function ReportsPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    const d = await fetch(`/api/reports/summary?period=${period}`).then((r) => r.json());
    if (d.error) return setErr(d.error);
    setData(d);
  }
  useEffect(() => {
    load();
  }, [period]);

  function exportCsv(type) {
    window.open(`/api/reports/export?type=${type}&period=${period}`, "_blank");
  }

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!data) return <p className="text-sm text-slate-400">Loading…</p>;
  const t = data.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Reports & export</h1>
          <p className="text-sm text-slate-500">Collection analytics, block-wise breakdown, and exports.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="label">Period</label>
            <input className="input w-32" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <button className="btn-ghost" onClick={() => window.print()}>Print / PDF</button>
        </div>
      </div>

      <div className="hidden text-xl font-semibold print:block">Society report — {data.period}</div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card label="Total billed" value={money(t.billed)} />
        <Card label="Collected" value={money(t.collected)} />
        <Card label="Outstanding" value={money(t.outstanding)} />
        <Card label="Collection efficiency" value={`${t.efficiency}%`} />
        <Card label="Penalties levied" value={money(t.penalty)} />
        <Card label="Approved expenses" value={money(t.expenseTotal)} />
        <Card label="GST collected" value={money(t.gst)} />
        <Card label="Sinking fund" value={money(t.sinkingFund)} />
        <Card label="Repair fund" value={money(t.repairFund)} />
        <Card label="Interest on arrears" value={money(t.interest)} />
        <Card label="Bills" value={t.count} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">Bills by status</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-1">Status</th><th>Count</th><th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {data.byStatus.map((s) => (
                <tr key={s.status} className="border-t border-slate-100">
                  <td className="py-2"><span className={`badge ${STATUS_STYLE[s.status] || ""}`}>{s.status}</span></td>
                  <td>{s.count}</td>
                  <td>{money(s.due)}</td>
                </tr>
              ))}
              {data.byStatus.length === 0 && <tr><td colSpan={3} className="py-4 text-slate-400">No bills.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">Block-wise</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-1">Block</th><th>Units</th><th>Billed</th><th>Collected</th>
              </tr>
            </thead>
            <tbody>
              {data.byBlock.map((b) => (
                <tr key={b.block} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{b.block}</td>
                  <td>{b.units}</td>
                  <td>{money(b.billed)}</td>
                  <td>{money(b.collected)}</td>
                </tr>
              ))}
              {data.byBlock.length === 0 && <tr><td colSpan={4} className="py-4 text-slate-400">No bills.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5 print:hidden">
        <h2 className="mb-3 text-sm font-semibold">Export (Excel / CSV)</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => exportCsv("bills")}>⬇ Bills CSV</button>
          <button className="btn-ghost" onClick={() => exportCsv("payments")}>⬇ Payments CSV</button>
          <button className="btn-ghost" onClick={() => exportCsv("expenses")}>⬇ Expenses CSV</button>
          <button className="btn-ghost" onClick={() => exportCsv("vendors")}>⬇ Vendor register</button>
          <button className="btn-ghost" onClick={() => exportCsv("contracts")}>⬇ Contracts</button>
          <button className="btn-ghost" onClick={() => exportCsv("reimbursements")}>⬇ Reimbursements</button>
          <button className="btn-ghost" onClick={() => exportCsv("complaints")}>⬇ Complaint resolution</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">CSV files open directly in Excel / Google Sheets. Use “Print / PDF” for a printable report.</p>
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
