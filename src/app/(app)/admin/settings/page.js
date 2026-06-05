"use client";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [society, setSociety] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const d = await fetch("/api/society/settings").then((r) => r.json());
    if (d.society) setSociety(d.society);
  }
  useEffect(() => {
    load();
  }, []);

  function setField(path, value) {
    setSociety((s) => {
      const next = { ...s };
      if (path.startsWith("settings.")) {
        next.settings = { ...(s.settings || {}), [path.slice(9)]: value };
      } else {
        next[path] = value;
      }
      return next;
    });
  }

  async function save(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const res = await fetch("/api/society/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: society.name,
        city: society.city,
        address: society.address,
        registrationNo: society.registrationNo,
        ward: society.ward,
        fyStartMonth: society.fyStartMonth,
        blockMode: society.blockMode,
        settings: society.settings,
      }),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setMsg("Settings saved.");
    setSociety(d.society);
  }

  if (!society) return <p className="text-sm text-slate-400">Loading…</p>;
  const s = society.settings || {};

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Society settings</h1>
        <p className="text-sm text-slate-500">Profile and finance defaults. These drive billing, due dates and late fees.</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <div className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Profile & registration</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div>
              <label className="label">Society name</label>
              <input className="input" value={society.name || ""} onChange={(e) => setField("name", e.target.value)} />
            </div>
            <div>
              <label className="label">Registration no. (MCS Act)</label>
              <input className="input" value={society.registrationNo || ""} onChange={(e) => setField("registrationNo", e.target.value)} />
            </div>
            <div>
              <label className="label">Ward / zone</label>
              <input className="input" value={society.ward || ""} onChange={(e) => setField("ward", e.target.value)} />
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" value={society.city || ""} onChange={(e) => setField("city", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Address</label>
              <input className="input" value={society.address || ""} onChange={(e) => setField("address", e.target.value)} />
            </div>
            <div>
              <label className="label">Financial year starts</label>
              <select className="input" value={society.fyStartMonth || 4} onChange={(e) => setField("fyStartMonth", Number(e.target.value))}>
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Finance defaults</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div>
              <label className="label">Late penalty (%)</label>
              <input className="input" value={s.penaltyPct ?? ""} onChange={(e) => setField("settings.penaltyPct", e.target.value)} />
            </div>
            <div>
              <label className="label">Min penalty (₹)</label>
              <input className="input" value={s.penaltyMin ?? ""} onChange={(e) => setField("settings.penaltyMin", e.target.value)} />
            </div>
            <div>
              <label className="label">Grace days</label>
              <input className="input" value={s.graceDays ?? ""} onChange={(e) => setField("settings.graceDays", e.target.value)} />
            </div>
            <div>
              <label className="label">Electricity rate (₹/unit)</label>
              <input className="input" value={s.defaultElectricityRate ?? ""} onChange={(e) => setField("settings.defaultElectricityRate", e.target.value)} />
            </div>
            <div>
              <label className="label">Default split rule</label>
              <select className="input" value={s.defaultSplitRule || "equal"} onChange={(e) => setField("settings.defaultSplitRule", e.target.value)}>
                <option value="equal">Equal</option>
                <option value="area">By area</option>
                <option value="block">By block</option>
              </select>
            </div>
            <div>
              <label className="label">Arrears interest (% p.a.)</label>
              <input className="input" value={s.arrearsInterestPct ?? ""} onChange={(e) => setField("settings.arrearsInterestPct", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">MOFA charge heads</h2>
          <p className="text-xs text-slate-500">These flow into every monthly bill as named heads. The maintenance charge is billed to every flat each month.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="label">Maintenance basis</label>
              <select className="input" value={s.maintenanceBasis || "flat"} onChange={(e) => setField("settings.maintenanceBasis", e.target.value)}>
                <option value="flat">Flat fee / flat</option>
                <option value="sqft">By carpet area (₹/sq.ft)</option>
              </select>
            </div>
            {(s.maintenanceBasis || "flat") === "sqft" ? (
              <div>
                <label className="label">Maintenance ₹/sq.ft</label>
                <input className="input" value={s.serviceChargePerSqft ?? ""} onChange={(e) => setField("settings.serviceChargePerSqft", e.target.value)} />
              </div>
            ) : (
              <div>
                <label className="label">Maintenance ₹/flat / month</label>
                <input className="input" value={s.serviceChargePerFlat ?? ""} onChange={(e) => setField("settings.serviceChargePerFlat", e.target.value)} />
              </div>
            )}
            <div>
              <label className="label">Sinking fund (₹/sq.ft)</label>
              <input className="input" value={s.sinkingFundRatePerSqft ?? ""} onChange={(e) => setField("settings.sinkingFundRatePerSqft", e.target.value)} />
            </div>
            <div>
              <label className="label">Repair fund (₹/sq.ft)</label>
              <input className="input" value={s.repairFundRatePerSqft ?? ""} onChange={(e) => setField("settings.repairFundRatePerSqft", e.target.value)} />
            </div>
            <div>
              <label className="label">Water charge / inlet (₹)</label>
              <input className="input" value={s.waterChargePerInlet ?? ""} onChange={(e) => setField("settings.waterChargePerInlet", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">GST & approvals</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="flex items-center gap-2 text-sm md:col-span-1">
              <input type="checkbox" checked={!!s.gstApplicable} onChange={(e) => setField("settings.gstApplicable", e.target.checked)} /> GST applicable
            </label>
            <div>
              <label className="label">GST rate (%)</label>
              <input className="input" value={s.gstRate ?? ""} onChange={(e) => setField("settings.gstRate", e.target.value)} />
            </div>
            <div>
              <label className="label">GST threshold / flat (₹)</label>
              <input className="input" value={s.gstThresholdPerFlat ?? ""} onChange={(e) => setField("settings.gstThresholdPerFlat", e.target.value)} />
            </div>
            <div>
              <label className="label">Approval levels</label>
              <select className="input" value={s.approvalLevels ?? 2} onChange={(e) => setField("settings.approvalLevels", Number(e.target.value))}>
                <option value={1}>1 — Finance only</option>
                <option value={2}>2 — Finance → Chairman</option>
                <option value={3}>3 — incl. Secretary pre-check</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary">Save settings</button>
          {msg && <span className="text-sm text-green-700">{msg}</span>}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </form>
    </div>
  );
}
