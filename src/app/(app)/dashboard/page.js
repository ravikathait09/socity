"use client";
import { useEffect, useState } from "react";

function money(n) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setData(d)))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!data) return <p className="text-sm text-slate-400">Loading…</p>;

  const s = data.stats;
  const cards = [
    { label: "Units", value: s.units },
    { label: "Blocks", value: s.blocks },
    { label: "Total billed", value: money(s.totalBilled) },
    { label: "Collected", value: money(s.totalCollected) },
    { label: "Outstanding", value: money(s.outstanding) },
    { label: "Approved expenses", value: money(s.approvedExpenses) },
    { label: "Overdue bills", value: s.overdueBills ?? 0 },
    { label: "Loan outstanding", value: money(s.loanOutstanding) },
    { label: "Sinking fund (billed)", value: money(s.sinkingFund) },
    { label: "Repair fund (billed)", value: money(s.repairFund) },
    { label: "GST liability", value: money(s.gstLiability) },
    { label: "Pending approvals", value: s.pendingApprovals ?? 0, alert: s.pendingApprovals > 0 },
    { label: "Pending reimbursements", value: s.pendingReimbursements ?? 0, alert: s.pendingReimbursements > 0 },
    { label: "Contracts expiring ≤30d", value: s.expiringContracts ?? 0, alert: s.expiringContracts > 0 },
    { label: "Complaint resolution", value: `${s.complaintResolutionRate ?? 0}%` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Society dashboard</h1>
        <p className="text-sm text-slate-500">Overview, totals & block-wise collections.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className={`card p-4 ${c.alert ? "ring-1 ring-amber-300" : ""}`}>
            <div className="text-xs uppercase tracking-wide text-slate-400">{c.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${c.alert ? "text-amber-600" : ""}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {data.towerShares?.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">Tower-share of all-tower expenses</h2>
          <div className="flex flex-wrap gap-3 text-sm">
            {data.towerShares.map((t) => (
              <div key={t.block} className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium">Tower {t.block}</span>
                <span className="ml-2 text-slate-500">{t.flats} flats · {t.sharePct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Block-wise report</h2>
        {data.byBlock.length === 0 ? (
          <p className="text-sm text-slate-400">No bills generated yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-2">Block</th>
                <th>Units</th>
                <th>Billed</th>
                <th>Collected</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {data.byBlock.map((b) => (
                <tr key={b.block} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{b.block}</td>
                  <td>{b.units}</td>
                  <td>{money(b.billed)}</td>
                  <td>{money(b.collected)}</td>
                  <td>{money(b.billed - b.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
