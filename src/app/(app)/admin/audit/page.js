"use client";
import { useEffect, useState } from "react";

const ACTION_STYLE = (a) => {
  if (a.startsWith("payment")) return "bg-green-100 text-green-700";
  if (a.startsWith("bill")) return "bg-blue-100 text-blue-700";
  if (a.startsWith("user") || a.startsWith("role")) return "bg-purple-100 text-purple-700";
  if (a.includes("delete")) return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
};

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setLogs(d.logs)))
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-slate-500">Append-only trail of finance & admin actions in this society.</p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l._id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">{new Date(l.at).toLocaleString()}</td>
                <td>{l.actorName || "—"}</td>
                <td><span className={`badge ${ACTION_STYLE(l.action)}`}>{l.action}</span></td>
                <td className="text-slate-600">{l.summary}</td>
              </tr>
            ))}
            {logs.length === 0 && !err && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No activity logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
