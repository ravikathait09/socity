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
  const [payments, setPayments] = useState([]);
  const [units, setUnits] = useState([]);
  const [err, setErr] = useState("");
  const [paying, setPaying] = useState(null);
  const [msg, setMsg] = useState("");

  function load() {
    fetch("/api/bills").then((r) => r.json()).then((d) => (d.error ? setErr(d.error) : setBills(d.bills || [])));
    fetch("/api/payments").then((r) => r.json()).then((d) => d.payments && setPayments(d.payments));
    fetch("/api/my-unit").then((r) => r.json()).then((d) => d.units && setUnits(d.units)).catch(() => {});
  }
  useEffect(() => { load(); }, []);

  async function payOnline(billId) {
    setPaying(billId); setMsg("");
    const res = await fetch("/api/payments/online", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billId }),
    });
    const d = await res.json();
    setPaying(null);
    if (!res.ok) return setMsg(d.error || "Payment failed");
    setMsg(`Paid ${money(d.payment.amount)} · ref ${d.payment.reference}`);
    load();
  }

  function downloadLedger() {
    const header = "Date,Period,Amount,Method,Reference\n";
    const rows = payments.map((p) =>
      [new Date(p.paidAt).toLocaleString("en-IN"), p.period || "", p.amount, p.method, p.reference || ""].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-payments.csv";
    a.click();
  }

  const totalDue = bills.reduce((s, b) => s + Math.max(0, b.total - b.paid), 0);
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My account</h1>
        <p className="text-sm text-slate-500">Your bills, payments and flat details — tenant-isolated.</p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-green-700">{msg}</p>}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card p-4"><div className="text-xs uppercase tracking-wide text-slate-400">Outstanding</div><div className={`mt-1 text-2xl font-semibold ${totalDue > 0 ? "text-red-600" : ""}`}>{money(totalDue)}</div></div>
        <div className="card p-4"><div className="text-xs uppercase tracking-wide text-slate-400">Bills</div><div className="mt-1 text-2xl font-semibold">{bills.length}</div></div>
        <div className="card p-4"><div className="text-xs uppercase tracking-wide text-slate-400">Total paid</div><div className="mt-1 text-2xl font-semibold">{money(totalPaid)}</div></div>
        <div className="card p-4"><div className="text-xs uppercase tracking-wide text-slate-400">{units.length > 1 ? "Flats" : "Flat"}</div><div className="mt-1 text-2xl font-semibold">{units.length > 1 ? units.length : (units[0]?.number || "—")}</div></div>
      </div>

      {/* My flat(s) / tenant management — one card per owned flat */}
      {units.map((u) => <MyUnit key={u._id} unit={u} onSaved={load} />)}

      {/* Bills */}
      <h2 className="text-sm font-semibold text-slate-600">Bills</h2>
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
                  <div className="flex justify-between py-1 text-sm text-red-600"><span>Late penalty</span><span>{money(b.penalty)}</span></div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-slate-500">{due > 0 ? `Due: ${money(due)}` : "Settled"}</span>
                <button className="btn-primary text-sm" disabled={due <= 0 || paying === b._id} onClick={() => payOnline(b._id)}>
                  {paying === b._id ? "Processing…" : due > 0 ? `Pay ${money(due)} online` : "Paid"}
                </button>
              </div>
            </div>
          );
        })}
        {bills.length === 0 && !err && <p className="text-sm text-slate-400">No bills yet for your unit.</p>}
      </div>

      {/* Payment ledger */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-600">Payment history</h2>
        {payments.length > 0 && <button className="btn-ghost text-xs" onClick={downloadLedger}>⬇ Download CSV</button>}
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Date</th><th>Period</th><th>Amount</th><th>Method</th><th>Reference</th><th className="pr-4 text-right">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p._id} className="border-t border-slate-100">
                <td className="px-4 py-2">{new Date(p.paidAt).toLocaleDateString("en-IN")}</td>
                <td>{p.period || "—"}</td>
                <td className="font-medium">{money(p.amount)}</td>
                <td><span className="badge bg-slate-100 text-slate-600">{p.method}</span></td>
                <td className="text-xs text-slate-500">{p.reference || "—"}</td>
                <td className="pr-4 text-right">
                  <a className="text-brand-600 hover:underline" href={`/api/payments/${p._id}/receipt`} target="_blank" rel="noreferrer">🧾 receipt</a>
                </td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Owner self-service: maintain the flat's tenant details + occupancy.
function MyUnit({ unit, onSaved }) {
  const [f, setF] = useState({
    occupancy: unit.occupancy || "owner",
    tenantName: unit.tenantName || "",
    tenantPhone: unit.tenantPhone || "",
    tenantEmail: unit.tenantEmail || "",
    leaseStart: unit.leaseStart ? unit.leaseStart.slice(0, 10) : "",
    leaseEnd: unit.leaseEnd ? unit.leaseEnd.slice(0, 10) : "",
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  async function save() {
    setErr(""); setMsg("");
    const res = await fetch("/api/my-unit", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, unitId: unit._id }) });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setMsg("Saved.");
    onSaved?.();
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">My flat — {unit.number}</h2>
          <p className="text-xs text-slate-500">{unit.bhk || ""} {unit.areaSqft ? `· ${unit.areaSqft} sq.ft` : ""} · {f.occupancy}{f.tenantName ? ` · tenant: ${f.tenantName}` : ""}</p>
        </div>
        <button className="btn-ghost text-xs" onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Manage tenant"}</button>
      </div>
      {open && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 md:grid-cols-3">
          <div>
            <label className="label">Occupancy</label>
            <select className="input" value={f.occupancy} onChange={(e) => setF({ ...f, occupancy: e.target.value })}>
              <option value="owner">Owner-occupied</option><option value="tenant">Rented (tenant)</option><option value="vacant">Vacant</option>
            </select>
          </div>
          <div><label className="label">Tenant name</label><input className="input" value={f.tenantName} onChange={(e) => setF({ ...f, tenantName: e.target.value })} /></div>
          <div><label className="label">Tenant phone</label><input className="input" value={f.tenantPhone} onChange={(e) => setF({ ...f, tenantPhone: e.target.value })} /></div>
          <div><label className="label">Tenant email</label><input className="input" value={f.tenantEmail} onChange={(e) => setF({ ...f, tenantEmail: e.target.value })} /></div>
          <div><label className="label">Lease start</label><input type="date" className="input" value={f.leaseStart} onChange={(e) => setF({ ...f, leaseStart: e.target.value })} /></div>
          <div><label className="label">Lease end</label><input type="date" className="input" value={f.leaseEnd} onChange={(e) => setF({ ...f, leaseEnd: e.target.value })} /></div>
          <div className="col-span-2 flex items-center gap-3 md:col-span-3">
            <button className="btn-primary" onClick={save}>Save flat details</button>
            {msg && <span className="text-sm text-green-700">{msg}</span>}
            {err && <span className="text-sm text-red-600">{err}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
