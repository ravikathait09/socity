"use client";
import { useEffect, useState } from "react";

function money(n) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function LegalFinancePage() {
  const [entities, setEntities] = useState([]);
  const [loans, setLoans] = useState([]);
  const [err, setErr] = useState("");
  const [ef, setEf] = useState({ name: "", kind: "block-group", blockCodes: "", description: "" });
  const [lf, setLf] = useState({ legalEntityId: "", purpose: "", lender: "", principal: "", annualRate: "", tenureMonths: "" });

  async function load() {
    const [e, l] = await Promise.all([
      fetch("/api/legal-entities").then((r) => r.json()),
      fetch("/api/loans").then((r) => r.json()),
    ]);
    if (e.entities) setEntities(e.entities);
    if (l.loans) setLoans(l.loans);
  }
  useEffect(() => {
    load();
  }, []);

  async function addEntity(e) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/legal-entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ef),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setEf({ name: "", kind: "block-group", blockCodes: "", description: "" });
    load();
  }

  async function addLoan(e) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lf),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setLf({ legalEntityId: "", purpose: "", lender: "", principal: "", annualRate: "", tenureMonths: "" });
    load();
  }

  async function repay(id) {
    const amount = prompt("Repayment amount (₹)?");
    if (!amount) return;
    await fetch(`/api/loans/${id}/repay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(amount) }),
    });
    load();
  }

  const entityName = (id) => entities.find((e) => e._id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Legal entity & finance</h1>
        <p className="text-sm text-slate-500">
          Block groups (A+B, C+D, E) as independent legal entities that hold funds and take loans.
        </p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Entities */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Legal entities</h2>
          {entities.map((e) => (
            <div key={e._id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{e.name}</div>
                <span className="badge bg-slate-100 text-slate-600">{e.kind}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {e.blockCodes?.length ? `Blocks: ${e.blockCodes.join(", ")}` : "—"}
                {e.description ? ` · ${e.description}` : ""}
              </div>
            </div>
          ))}
          <form onSubmit={addEntity} className="card space-y-2 p-4">
            <input className="input" placeholder="Entity name (e.g. Greenwood A+B Assoc.)" value={ef.name} onChange={(e) => setEf({ ...ef, name: e.target.value })} />
            <div className="flex gap-2">
              <select className="input" value={ef.kind} onChange={(e) => setEf({ ...ef, kind: e.target.value })}>
                <option value="block-group">Block group</option>
                <option value="society">Society</option>
              </select>
              <input className="input" placeholder="Blocks (A,B)" value={ef.blockCodes} onChange={(e) => setEf({ ...ef, blockCodes: e.target.value })} />
            </div>
            <button className="btn-primary w-full">Add entity</button>
          </form>
        </div>

        {/* Loans */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Loans</h2>
          {loans.map((l) => (
            <div key={l._id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{l.purpose}</div>
                  <div className="text-xs text-slate-500">
                    {entityName(l.legalEntityId)} · {l.lender || "—"}
                  </div>
                </div>
                <span className={`badge ${l.status === "closed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                  {l.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <Stat label="Principal" value={money(l.principal)} />
                <Stat label="EMI" value={money(l.summary.emi)} />
                <Stat label="Repaid" value={money(l.summary.repaid)} />
                <Stat label="Outstanding" value={money(l.summary.outstanding)} />
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {l.annualRate}% p.a. · {l.tenureMonths} months · total payable {money(l.summary.totalPayable)}
              </div>
              {l.status !== "closed" && (
                <button className="btn-ghost mt-2 text-xs" onClick={() => repay(l._id)}>
                  Record repayment
                </button>
              )}
            </div>
          ))}
          <form onSubmit={addLoan} className="card space-y-2 p-4">
            <select className="input" value={lf.legalEntityId} onChange={(e) => setLf({ ...lf, legalEntityId: e.target.value })}>
              <option value="">Select legal entity…</option>
              {entities.map((e) => (
                <option key={e._id} value={e._id}>{e.name}</option>
              ))}
            </select>
            <input className="input" placeholder="Purpose (e.g. Lift replacement)" value={lf.purpose} onChange={(e) => setLf({ ...lf, purpose: e.target.value })} />
            <div className="flex gap-2">
              <input className="input" placeholder="Lender" value={lf.lender} onChange={(e) => setLf({ ...lf, lender: e.target.value })} />
              <input className="input" placeholder="Principal" value={lf.principal} onChange={(e) => setLf({ ...lf, principal: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <input className="input" placeholder="Rate % p.a." value={lf.annualRate} onChange={(e) => setLf({ ...lf, annualRate: e.target.value })} />
              <input className="input" placeholder="Tenure (months)" value={lf.tenureMonths} onChange={(e) => setLf({ ...lf, tenureMonths: e.target.value })} />
            </div>
            <button className="btn-primary w-full">Add loan</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
