"use client";
import { useEffect, useState } from "react";

export default function MinutesPage() {
  const [minutes, setMinutes] = useState([]);
  const [form, setForm] = useState({ title: "", meetingDate: "", attendees: "", body: "" });
  const [err, setErr] = useState("");

  async function load() {
    const m = await fetch("/api/minutes").then((r) => r.json());
    if (m.minutes) setMinutes(m.minutes);
  }
  useEffect(() => {
    load();
  }, []);

  async function post(e) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/minutes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setForm({ title: "", meetingDate: "", attendees: "", body: "" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Meeting minutes</h1>
        <p className="text-sm text-slate-500">AGM & committee meeting records.</p>
      </div>

      <form onSubmit={post} className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Record minutes</h2>
        <div className="grid grid-cols-2 gap-3">
          <input className="input" placeholder="Title (e.g. AGM Mar 2026)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="input" type="date" value={form.meetingDate} onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} />
        </div>
        <input className="input" placeholder="Attendees (comma separated)" value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} />
        <textarea className="input" rows={4} placeholder="Minutes / resolutions…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <button className="btn-primary">Save minutes</button>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>

      <div className="space-y-3">
        {minutes.map((m) => (
          <div key={m._id} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{m.title}</span>
              <span className="text-xs text-slate-400">
                {m.meetingDate ? new Date(m.meetingDate).toLocaleDateString() : ""}
              </span>
            </div>
            {m.attendees?.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">Attendees: {m.attendees.join(", ")}</p>
            )}
            {m.body && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{m.body}</p>}
          </div>
        ))}
        {minutes.length === 0 && <p className="text-sm text-slate-400">No minutes recorded yet.</p>}
      </div>
    </div>
  );
}
