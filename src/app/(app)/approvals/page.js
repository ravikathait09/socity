"use client";
import { useEffect, useState } from "react";
import { hasPermission } from "@/lib/rbac";

const STATUS_STYLE = {
  pending_l1: "bg-amber-100 text-amber-700",
  pending_l2: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-slate-200 text-slate-600",
};
const TYPES = [
  ["material", "Material purchase"],
  ["service", "Service contract"],
  ["repair", "Repair / work order"],
  ["overtime", "Staff overtime"],
  ["event", "Event / festival budget"],
  ["emergency", "Emergency repair"],
];
function money(n) { return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

export default function ApprovalsPage() {
  const [requests, setRequests] = useState([]);
  const [perms, setPerms] = useState([]);
  const [form, setForm] = useState({ type: "material", title: "", description: "", estimatedCost: "", vendorName: "", emergency: false });
  const [err, setErr] = useState("");

  const canRaise = hasPermission(perms, "requests.raise");
  const canL1 = hasPermission(perms, "requests.approve_l1");
  const canL2 = hasPermission(perms, "requests.approve_l2");
  const canEmergency = hasPermission(perms, "maintenance.assign");

  async function load() {
    const [r, me] = await Promise.all([
      fetch("/api/work-requests").then((x) => x.json()),
      fetch("/api/auth/me").then((x) => x.json()),
    ]);
    if (r.requests) setRequests(r.requests);
    if (me.session) setPerms(me.session.permissions || []);
  }
  useEffect(() => { load(); }, []);

  async function raise(e) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/work-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, estimatedCost: Number(form.estimatedCost) || 0 }),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setForm({ type: "material", title: "", description: "", estimatedCost: "", vendorName: "", emergency: false });
    load();
  }

  async function act(id, action, extra = {}) {
    if (action === "reject") {
      const note = prompt("Reason for rejection (required):");
      if (!note) return;
      extra.note = note;
    }
    if (action === "approve" && canL2) {
      // optional chairman condition prompt handled inline below for pending_l2
    }
    await fetch(`/api/work-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-sm text-slate-500">
          Purchase, service and repair requests flow through Finance (Level 1) → Chairman (Level 2) before execution.
        </p>
      </div>

      {canRaise && (
        <form onSubmit={raise} className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-6">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Replace lobby CCTV" />
          </div>
          <div>
            <label className="label">Est. cost (₹)</label>
            <input className="input" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} />
          </div>
          <div>
            <label className="label">Vendor (quote)</label>
            <input className="input" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} />
          </div>
          {canEmergency && (
            <label className="flex items-end gap-2 text-sm">
              <input type="checkbox" checked={form.emergency} onChange={(e) => setForm({ ...form, emergency: e.target.checked })} /> Emergency (skip L1)
            </label>
          )}
          <div className="col-span-2 md:col-span-6">
            <label className="label">Details</label>
            <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="col-span-2 md:col-span-6">
            <button className="btn-primary">Raise request</button>
            {err && <span className="ml-3 text-sm text-red-600">{err}</span>}
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Req</th>
              <th>Title</th>
              <th>Type</th>
              <th>Est. cost</th>
              <th>Raised by</th>
              <th>Status</th>
              <th className="pr-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r._id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-2 font-mono text-xs">{r.code}{r.emergency && <span className="ml-1 badge bg-red-100 text-red-700">SOS</span>}</td>
                <td>
                  <div className="font-medium">{r.title}</div>
                  {r.description && <div className="text-xs text-slate-400">{r.description}</div>}
                  {r.financeRemark && <div className="text-xs text-blue-600">Finance: {r.financeRemark}</div>}
                  {r.chairmanCondition && <div className="text-xs text-purple-600">Chairman: {r.chairmanCondition}</div>}
                  {r.rejectedReason && <div className="text-xs text-red-600">Rejected: {r.rejectedReason}</div>}
                </td>
                <td>{r.type}</td>
                <td>{money(r.estimatedCost)}</td>
                <td className="text-slate-500">{r.raisedByName}</td>
                <td><span className={`badge ${STATUS_STYLE[r.status] || ""}`}>{r.status.replace("_", " ")}</span></td>
                <td className="pr-4 text-right">
                  <div className="flex flex-col items-end gap-1">
                    {r.status === "pending_l1" && canL1 && (
                      <div className="flex gap-1">
                        <button className="btn-ghost text-xs" onClick={() => { const remark = prompt("Budget remark (optional):") || undefined; act(r._id, "approve", { remark }); }}>Approve L1</button>
                        <button className="btn-ghost text-xs text-red-600" onClick={() => act(r._id, "reject")}>Reject</button>
                      </div>
                    )}
                    {r.status === "pending_l2" && canL2 && (
                      <div className="flex gap-1">
                        <button className="btn-ghost text-xs" onClick={() => { const condition = prompt("Approve with conditions? (optional):") || undefined; act(r._id, "approve", { condition }); }}>Approve L2</button>
                        <button className="btn-ghost text-xs text-red-600" onClick={() => act(r._id, "reject")}>Reject</button>
                      </div>
                    )}
                    {r.status === "approved" && (
                      <button className="btn-ghost text-xs" onClick={() => { const note = prompt("Completion note (optional):") || undefined; act(r._id, "complete", { note }); }}>Mark done</button>
                    )}
                    {["completed", "rejected"].includes(r.status) && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
