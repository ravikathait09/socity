"use client";
import { useEffect, useState } from "react";
import { hasPermission } from "@/lib/rbac";

const STATUS_STYLE = {
  open: "bg-amber-100 text-amber-700",
  assigned: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  resolved: "bg-teal-100 text-teal-700",
  closed: "bg-green-100 text-green-700",
};
const PRIORITY_STYLE = {
  low: "bg-slate-100 text-slate-500",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};
function readFile(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

export default function MaintenancePage() {
  const [requests, setRequests] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [perms, setPerms] = useState([]);
  const [uid, setUid] = useState("");
  const [form, setForm] = useState({ title: "", description: "", category: "general", priority: "medium", slaHours: "" });
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");

  const canManage = hasPermission(perms, "maintenance.assign");
  const canRaise = hasPermission(perms, "maintenance.raise");

  async function load() {
    const [r, me] = await Promise.all([
      fetch("/api/maintenance").then((x) => x.json()),
      fetch("/api/auth/me").then((x) => x.json()),
    ]);
    if (r.requests) setRequests(r.requests);
    if (me.session) { setPerms(me.session.permissions || []); setUid(me.session.uid); }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (hasPermission(perms, "maintenance.vendors")) {
      fetch("/api/vendors").then((x) => x.json()).then((d) => d.vendors && setVendors(d.vendors));
    }
  }, [perms]);

  async function raise(e) {
    e.preventDefault();
    setErr("");
    const payload = { ...form, slaHours: form.slaHours ? Number(form.slaHours) : undefined };
    if (file) payload.photo = { name: file.name, mimeType: file.type, contentBase64: await readFile(file) };
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setForm({ title: "", description: "", category: "general", priority: "medium", slaHours: "" });
    setFile(null);
    e.target.reset?.();
    load();
  }

  async function patch(id, body) {
    const res = await fetch(`/api/maintenance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Maintenance & complaints</h1>
          <p className="text-sm text-slate-500">
            {canManage ? "Assign vendors, track SLA and resolve work orders." : "Raise a complaint with a photo — track its status and rate the fix."}
          </p>
        </div>
        {canManage && <a className="btn-ghost text-xs" href="/api/reports/export?type=complaints" target="_blank" rel="noreferrer">Export resolution report</a>}
      </div>

      {canRaise && (
        <form onSubmit={raise} className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-6">
          <div className="col-span-2">
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Leaking tap in bathroom" />
          </div>
          <div>
            <label className="label">Category</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="plumbing" />
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="label">SLA (hours)</label>
            <input className="input" value={form.slaHours} onChange={(e) => setForm({ ...form, slaHours: e.target.value })} placeholder="48" />
          </div>
          <div>
            <label className="label">Photo</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
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
              <th className="px-4 py-2">WO</th>
              <th>Title</th>
              {canManage && <th>Raised by</th>}
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned</th>
              <th>Rating</th>
              {canManage && <th></th>}
              {!canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const mine = String(r.raisedById) === String(uid);
              return (
                <tr key={r._id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                  <td>
                    <div className="font-medium">{r.title}</div>
                    {r.description && <div className="text-xs text-slate-400">{r.description}</div>}
                    <div className="text-xs text-slate-400">
                      {r.category}
                      {r.photo?.name && <a className="ml-2 text-brand-600 hover:underline" href={`/api/maintenance/${r._id}/photo`} target="_blank" rel="noreferrer">📷 photo</a>}
                      {r.slaHours ? <span className={`ml-2 ${r.slaBreached ? "text-red-600" : "text-slate-400"}`}>SLA {r.slaHours}h{r.slaBreached ? " breached" : ""}</span> : null}
                    </div>
                  </td>
                  {canManage && (
                    <td className="text-slate-500">
                      {r.raisedByName}
                      {r.unitNumber ? <span className="block text-xs">{r.unitNumber}</span> : null}
                    </td>
                  )}
                  <td><span className={`badge ${PRIORITY_STYLE[r.priority] || ""}`}>{r.priority}</span></td>
                  <td><span className={`badge ${STATUS_STYLE[r.status] || ""}`}>{r.status.replace("_", " ")}</span></td>
                  <td className="text-slate-500">{r.assignedToName || "—"}</td>
                  <td className="text-amber-500">{r.satisfactionRating ? "★".repeat(r.satisfactionRating) : "—"}</td>
                  {canManage && (
                    <td className="pr-4">
                      {!["resolved", "closed"].includes(r.status) ? (
                        <div className="flex flex-col gap-1">
                          <select className="input text-xs" value={r.assignedVendorId || ""} onChange={(e) => patch(r._id, { assignedVendorId: e.target.value })}>
                            <option value="">Assign vendor…</option>
                            {vendors.map((v) => <option key={v._id} value={v._id}>{v.name} ({v.serviceCategory || v.trade})</option>)}
                          </select>
                          <div className="flex gap-1">
                            {r.status !== "in_progress" && <button className="btn-ghost text-xs" onClick={() => patch(r._id, { status: "in_progress" })}>Start</button>}
                            <button className="btn-ghost text-xs" onClick={() => patch(r._id, { status: "resolved", resolutionNote: prompt("Resolution note:") || "Resolved" })}>Resolve</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-400">{r.resolutionNote || r.status}</span>
                          {r.status === "resolved" && <button className="btn-ghost text-xs" onClick={() => patch(r._id, { status: "closed" })}>Close</button>}
                        </div>
                      )}
                    </td>
                  )}
                  {!canManage && (
                    <td className="pr-4 text-right">
                      {mine && ["resolved", "closed"].includes(r.status) && !r.satisfactionRating && (
                        <select className="input h-8 w-28 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) patch(r._id, { satisfactionRating: Number(e.target.value), satisfactionComment: "" }); }}>
                          <option value="">Rate fix…</option>
                          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
                        </select>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {requests.length === 0 && (
              <tr><td colSpan={canManage ? 8 : 7} className="px-4 py-6 text-center text-slate-400">No requests yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
