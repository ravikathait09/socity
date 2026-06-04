"use client";
import { useEffect, useState } from "react";
import { currentPeriod } from "@/lib/period";

const THIS_PERIOD = currentPeriod();

export default function MeterReadingsPage() {
  const [units, setUnits] = useState([]);
  const [readings, setReadings] = useState({});
  const [period, setPeriod] = useState(THIS_PERIOD);
  const [msg, setMsg] = useState("");

  async function load() {
    const u = await fetch("/api/units").then((r) => r.json());
    if (u.units) setUnits(u.units);
    const r = await fetch(`/api/meter-readings?period=${period}`).then((x) => x.json());
    if (r.readings) {
      const map = {};
      r.readings.forEach((x) => (map[x.unitId] = x));
      setReadings(map);
    }
  }
  useEffect(() => {
    load();
  }, [period]);

  async function save(unitId, current, rate) {
    setMsg("");
    const res = await fetch("/api/meter-readings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId, period, current: Number(current), ratePerUnit: Number(rate) }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "Failed");
    setReadings((p) => ({ ...p, [unitId]: data.reading }));
    setMsg("Saved " + new Date().toLocaleTimeString());
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Meter readings</h1>
          <p className="text-sm text-slate-500">Per-unit electricity consumption.</p>
        </div>
        <div>
          <label className="label">Period</label>
          <input className="input w-32" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
      </div>
      {msg && <p className="text-sm text-slate-500">{msg}</p>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Unit</th>
              <th>Previous</th>
              <th>Current</th>
              <th>Units</th>
              <th>Rate ₹</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <Row key={u._id} unit={u} reading={readings[u._id]} onSave={save} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ unit, reading, onSave }) {
  const [current, setCurrent] = useState(reading?.current ?? "");
  const [rate, setRate] = useState(reading?.ratePerUnit ?? 9);
  useEffect(() => {
    setCurrent(reading?.current ?? "");
    setRate(reading?.ratePerUnit ?? 9);
  }, [reading]);
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2 font-medium">{unit.number}</td>
      <td className="text-slate-500">{reading?.previous ?? 0}</td>
      <td>
        <input className="input w-24" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </td>
      <td className="font-medium">{reading?.units ?? "—"}</td>
      <td>
        <input className="input w-20" value={rate} onChange={(e) => setRate(e.target.value)} />
      </td>
      <td>
        <button className="btn-ghost text-xs" onClick={() => onSave(unit._id, current, rate)}>
          Save
        </button>
      </td>
    </tr>
  );
}
