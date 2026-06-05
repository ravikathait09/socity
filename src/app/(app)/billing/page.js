"use client";
import { useEffect, useState, Fragment } from "react";
import { currentPeriod } from "@/lib/period";

function money(n) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function BillingPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [bills, setBills] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(new Set());

  async function load() {
    const r = await fetch(`/api/bills?period=${period}`).then((x) => x.json());
    if (r.bills) setBills(r.bills);
  }
  useEffect(() => {
    load();
  }, [period]);

  async function generate(force = false) {
    if (force && !confirm("Recompute UNPAID bills for this period with the current settings? Paid bills are never changed.")) return;
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/bills/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period, force }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg(data.error || "Failed");
    const r = data.result;
    setMsg(`Created ${r.created} new bill(s)${r.kept ? `, kept ${r.kept} existing` : ""}${r.locked ? `, ${r.locked} settled left frozen` : ""} · from ${r.expenses} approved expenses.`);
    load();
  }

  function toggle(id) {
    setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const total = bills.reduce((s, b) => s + b.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="text-sm text-slate-500">
            Monthly bills = maintenance + sinking/repair funds + water + pro-rated common expenses (+ GST / interest).
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="label">Period</label>
            <input className="input w-32" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={() => generate(false)} disabled={busy}>
            {busy ? "Generating…" : "Generate bills"}
          </button>
          <button className="btn-ghost" onClick={() => generate(true)} disabled={busy} title="Recompute unpaid bills with current settings">
            Regenerate unpaid
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <b>Bill formula (per flat):</b> Maintenance charge + Sinking fund + Repair fund + Water charges + Common (pro-rated approved expenses) + GST + Interest on arrears + Late penalty.
        <span className="mt-1 block text-xs text-slate-400">“Generate bills” only adds bills for units that don’t have one yet — existing & paid bills are never changed when you edit settings. Use “Regenerate unpaid” to refresh unpaid bills.</span>
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
              <th className="px-4 py-2 w-6"></th>
              <th>Unit</th>
              <th>Block</th>
              <th>Maintenance ₹</th>
              <th>Funds ₹</th>
              <th>Water ₹</th>
              <th>Common ₹</th>
              <th>GST/Int ₹</th>
              <th>Total ₹</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => {
              const open = expanded.has(b._id);
              const items = [
                ...(b.lineItems || []),
                ...(b.penalty > 0 ? [{ label: "Late penalty", amount: b.penalty }] : []),
              ];
              return (
                <Fragment key={b._id}>
                  <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => toggle(b._id)}>
                    <td className="px-4 py-2 text-slate-400">{open ? "▾" : "▸"}</td>
                    <td className="font-medium">{b.unitNumber}</td>
                    <td>{b.blockCode || "—"}</td>
                    <td>{money(b.serviceCharge)}</td>
                    <td>{money((b.sinkingFund || 0) + (b.repairFund || 0))}</td>
                    <td>{money(b.waterCharge)}</td>
                    <td>{money(b.commonCharge)}</td>
                    <td>{money((b.gst || 0) + (b.interest || 0))}</td>
                    <td className="font-semibold">{money(b.total)}</td>
                    <td><span className="badge bg-amber-100 text-amber-700">{b.status}</span></td>
                  </tr>
                  {open && (
                    <tr className="bg-slate-50/60">
                      <td></td>
                      <td colSpan={9} className="px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Breakdown — {b.unitNumber}</div>
                        <div className="mt-1 max-w-md">
                          {items.map((li, i) => (
                            <div key={i} className="flex justify-between py-0.5 text-sm">
                              <span className="text-slate-600">{li.label}</span>
                              <span>{money(li.amount)}</span>
                            </div>
                          ))}
                          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 text-sm font-semibold">
                            <span>Total</span><span>{money(b.total)}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {bills.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-slate-400">
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
