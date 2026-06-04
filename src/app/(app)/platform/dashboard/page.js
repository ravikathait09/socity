"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

function money(n) { return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

export default function PlatformDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/platform/stats")
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setData(d)))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!data) return <p className="text-sm text-slate-400">Loading…</p>;

  const s = data.stats;
  const cards = [
    { label: "Societies", value: s.societies },
    { label: "Active", value: s.activeSocieties },
    { label: "Suspended", value: s.suspendedSocieties, alert: s.suspendedSocieties > 0 },
    { label: "Tenant users", value: s.tenantUsers },
    { label: "Units (all tenants)", value: s.totalUnits },
    { label: "Billed (platform)", value: money(s.totalBilled) },
    { label: "Collected (platform)", value: money(s.totalCollected) },
    { label: "Collection %", value: s.totalBilled ? Math.round((s.totalCollected / s.totalBilled) * 100) + "%" : "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Platform dashboard</h1>
          <p className="text-sm text-slate-500">Cross-tenant overview of every society on the platform.</p>
        </div>
        <Link href="/platform" className="btn-primary">Manage societies</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={`card p-4 ${c.alert ? "ring-1 ring-amber-300" : ""}`}>
            <div className="text-xs uppercase tracking-wide text-slate-400">{c.label}</div>
            <div className={`mt-1 text-2xl font-semibold ${c.alert ? "text-amber-600" : ""}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Societies</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Society</th>
              <th>City</th>
              <th>Users</th>
              <th>Units</th>
              <th>Status</th>
              <th className="pr-4 text-right">Onboarded</th>
            </tr>
          </thead>
          <tbody>
            {data.societies.map((r) => (
              <tr key={r._id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{r.name}<span className="ml-2 font-mono text-xs text-slate-400">{r.slug}</span></td>
                <td>{r.city || "—"}</td>
                <td>{r.userCount}</td>
                <td>{r.unitCount}</td>
                <td><span className={`badge ${r.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>{r.active ? "active" : "suspended"}</span></td>
                <td className="pr-4 text-right text-slate-400">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "—"}</td>
              </tr>
            ))}
            {data.societies.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No societies yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
