"use client";
import { useEffect, useState } from "react";
import { hasPermission } from "@/lib/rbac";

const CAT_STYLE = {
  urgent: "bg-red-100 text-red-700",
  circular: "bg-blue-100 text-blue-700",
  event: "bg-purple-100 text-purple-700",
  agm: "bg-emerald-100 text-emerald-700",
  general: "bg-slate-100 text-slate-600",
};

export default function NoticesPage() {
  const [notices, setNotices] = useState([]);
  const [perms, setPerms] = useState([]);
  const [form, setForm] = useState({ title: "", body: "", category: "general", pinned: false, meetingDate: "", agenda: "" });
  const [err, setErr] = useState("");

  const canPost = hasPermission(perms, "admin.notice");

  async function load() {
    const [n, me] = await Promise.all([
      fetch("/api/notices").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ]);
    if (n.notices) setNotices(n.notices);
    if (me.session) setPerms(me.session.permissions || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function post(e) {
    e.preventDefault();
    setErr("");
    const payload = { ...form };
    if (form.category === "agm") {
      payload.agenda = form.agenda ? form.agenda.split("\n").map((s) => s.trim()).filter(Boolean) : [];
    }
    const res = await fetch("/api/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setForm({ title: "", body: "", category: "general", pinned: false, meetingDate: "", agenda: "" });
    load();
  }

  async function remove(id) {
    await fetch(`/api/notices/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notice board</h1>
        <p className="text-sm text-slate-500">Circulars & announcements for all residents.</p>
      </div>

      {canPost && (
        <form onSubmit={post} className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Post a notice</h2>
          <input className="input" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="input" rows={3} placeholder="Details…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="flex items-center gap-3">
            <select className="input w-40" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="general">General</option>
              <option value="circular">Circular</option>
              <option value="urgent">Urgent</option>
              <option value="event">Event</option>
              <option value="agm">AGM notice</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
              Pin to top
            </label>
            <button className="btn-primary ml-auto">Post</button>
          </div>
          {form.category === "agm" && (
            <div className="grid grid-cols-1 gap-3 rounded-lg bg-emerald-50/60 p-3 md:grid-cols-2">
              <div>
                <label className="label">Meeting date</label>
                <input type="date" className="input" value={form.meetingDate} onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} />
              </div>
              <div>
                <label className="label">Agenda (one item per line)</label>
                <textarea className="input" rows={3} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} placeholder={"Adoption of accounts\nElection of office bearers"} />
              </div>
            </div>
          )}
          {err && <p className="text-sm text-red-600">{err}</p>}
        </form>
      )}

      <div className="space-y-3">
        {notices.map((n) => (
          <div key={n._id} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {n.pinned && <span className="text-amber-500">📌</span>}
                  <span className="font-semibold">{n.title}</span>
                  <span className={`badge ${CAT_STYLE[n.category] || ""}`}>{n.category}</span>
                </div>
                {n.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{n.body}</p>}
                {n.category === "agm" && (
                  <div className="mt-2 rounded-lg bg-emerald-50/60 p-2 text-sm">
                    {n.meetingDate && <div className="font-medium text-emerald-800">📅 {new Date(n.meetingDate).toDateString()}</div>}
                    {n.agenda?.length > 0 && (
                      <ol className="ml-4 list-decimal text-slate-600">
                        {n.agenda.map((a, i) => <li key={i}>{a}</li>)}
                      </ol>
                    )}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  {n.postedByName || "Admin"} · {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              {canPost && (
                <button onClick={() => remove(n._id)} className="text-slate-300 hover:text-red-600">✕</button>
              )}
            </div>
          </div>
        ))}
        {notices.length === 0 && <p className="text-sm text-slate-400">No notices yet.</p>}
      </div>
    </div>
  );
}
