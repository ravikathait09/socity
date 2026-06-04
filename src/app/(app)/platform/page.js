"use client";
import { useEffect, useState } from "react";

export default function PlatformPage() {
  const [societies, setSocieties] = useState([]);
  const [form, setForm] = useState({ name: "", city: "", registrationNo: "", ward: "", blockMode: "standalone", adminName: "", adminEmail: "", adminPassword: "" });
  const [err, setErr] = useState("");
  const [created, setCreated] = useState(null);
  const [editId, setEditId] = useState(null);

  async function load() {
    const d = await fetch("/api/societies").then((r) => r.json());
    if (d.societies) setSocieties(d.societies);
  }
  useEffect(() => { load(); }, []);

  async function onboard(e) {
    e.preventDefault();
    setErr(""); setCreated(null);
    const res = await fetch("/api/societies", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setCreated(d);
    setForm({ name: "", city: "", registrationNo: "", ward: "", blockMode: "standalone", adminName: "", adminEmail: "", adminPassword: "" });
    load();
  }

  async function toggleActive(s) {
    if (!confirm(`${s.active ? "Suspend" : "Re-activate"} ${s.name}?`)) return;
    await fetch(`/api/societies/${s._id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !s.active }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Platform — societies</h1>
        <p className="text-sm text-slate-500">Onboard, configure and suspend tenants. Each gets its own roles and an isolated workspace.</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Society</th>
              <th>Slug</th>
              <th>City</th>
              <th>Reg. no.</th>
              <th>Users</th>
              <th>Status</th>
              <th className="pr-4 text-right">Manage</th>
            </tr>
          </thead>
          <tbody>
            {societies.map((s) => (
              <tr key={s._id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="font-mono text-xs text-slate-500">{s.slug}</td>
                <td>{s.city || "—"}</td>
                <td className="text-slate-500">{s.registrationNo || "—"}</td>
                <td>{s.userCount}</td>
                <td><span className={`badge ${s.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>{s.active ? "active" : "suspended"}</span></td>
                <td className="pr-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="btn-ghost text-xs" onClick={() => setEditId(s._id)}>Configure</button>
                    <button className="btn-ghost text-xs text-red-600" onClick={() => toggleActive(s)}>{s.active ? "Suspend" : "Activate"}</button>
                  </div>
                </td>
              </tr>
            ))}
            {societies.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No societies yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <form onSubmit={onboard} className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Onboard a new society</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <input className="input" placeholder="Society name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <select className="input" value={form.blockMode} onChange={(e) => setForm({ ...form, blockMode: e.target.value })}>
            <option value="standalone">Standalone blocks</option>
            <option value="grouped">Grouped blocks</option>
          </select>
          <input className="input" placeholder="Registration no. (MCS Act)" value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} />
          <input className="input" placeholder="Ward / zone" value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} />
        </div>
        <h3 className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">First Society admin</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <input className="input" placeholder="Admin name" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
          <input className="input" placeholder="Admin email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
          <input className="input" type="password" placeholder="Admin password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
        </div>
        <button className="btn-primary">Onboard society</button>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {created && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Created <b>{created.society.name}</b> (slug {created.society.slug}). Society admin: <b>{created.admin.email}</b> — they can sign in now.
          </p>
        )}
      </form>

      {editId && <ConfigureModal id={editId} onClose={() => { setEditId(null); load(); }} />}
    </div>
  );
}

// Per-tenant settings editor (platform.onboard). Mirrors the Society Settings
// screen but targets any tenant by id.
function ConfigureModal({ id, onClose }) {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/societies/${id}`).then((r) => r.json()).then((d) => d.society && setS(d.society));
  }, [id]);

  function setField(path, value) {
    setS((cur) => {
      const next = { ...cur };
      if (path.startsWith("settings.")) next.settings = { ...(cur.settings || {}), [path.slice(9)]: value };
      else next[path] = value;
      return next;
    });
  }

  async function save() {
    setErr(""); setMsg("");
    const res = await fetch(`/api/societies/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: s.name, city: s.city, address: s.address, registrationNo: s.registrationNo,
        ward: s.ward, fyStartMonth: s.fyStartMonth, blockMode: s.blockMode, settings: s.settings,
      }),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setS(d.society); setMsg("Saved.");
  }

  const cfg = s?.settings || {};
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        {!s ? <p className="text-sm text-slate-400">Loading…</p> : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Configure {s.name}</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Profile & registration</h4>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <input className="input" placeholder="Name" value={s.name || ""} onChange={(e) => setField("name", e.target.value)} />
              <input className="input" placeholder="Registration no." value={s.registrationNo || ""} onChange={(e) => setField("registrationNo", e.target.value)} />
              <input className="input" placeholder="Ward" value={s.ward || ""} onChange={(e) => setField("ward", e.target.value)} />
              <input className="input" placeholder="City" value={s.city || ""} onChange={(e) => setField("city", e.target.value)} />
              <select className="input" value={s.fyStartMonth || 4} onChange={(e) => setField("fyStartMonth", Number(e.target.value))}>
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select className="input" value={s.blockMode} onChange={(e) => setField("blockMode", e.target.value)}>
                <option value="standalone">Standalone</option><option value="grouped">Grouped</option>
              </select>
            </div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Finance & MOFA</h4>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Penalty %", "penaltyPct"], ["Grace days", "graceDays"], ["Electricity ₹/unit", "defaultElectricityRate"],
                ["Service ₹/flat", "serviceChargePerFlat"], ["Sinking ₹/sqft", "sinkingFundRatePerSqft"],
                ["Repair ₹/sqft", "repairFundRatePerSqft"], ["Water ₹/inlet", "waterChargePerInlet"],
                ["Arrears % p.a.", "arrearsInterestPct"], ["GST rate %", "gstRate"], ["GST threshold ₹", "gstThresholdPerFlat"],
              ].map(([label, key]) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input className="input" value={cfg[key] ?? ""} onChange={(e) => setField(`settings.${key}`, e.target.value)} />
                </div>
              ))}
              <div>
                <label className="label">Approval levels</label>
                <select className="input" value={cfg.approvalLevels ?? 2} onChange={(e) => setField("settings.approvalLevels", Number(e.target.value))}>
                  <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!cfg.gstApplicable} onChange={(e) => setField("settings.gstApplicable", e.target.checked)} /> GST applicable
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button className="btn-primary" onClick={save}>Save settings</button>
              {msg && <span className="text-sm text-green-700">{msg}</span>}
              {err && <span className="text-sm text-red-600">{err}</span>}
            </div>

            <AdminAccess societyId={id} />
          </>
        )}
      </div>
    </div>
  );
}

// Super admin manages the tenant's Society-admin login (email / password reset).
function AdminAccess({ societyId }) {
  const [admins, setAdmins] = useState([]);
  const [edits, setEdits] = useState({}); // userId -> { email, password }
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const d = await fetch(`/api/societies/${societyId}/admin`).then((r) => r.json());
    if (d.admins) {
      setAdmins(d.admins);
      const seed = {};
      d.admins.forEach((a) => (seed[a._id] = { email: a.email, password: "" }));
      setEdits(seed);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [societyId]);

  async function save(userId) {
    setErr(""); setMsg("");
    const e = edits[userId] || {};
    const body = { userId };
    if (e.email) body.email = e.email;
    if (e.password) body.password = e.password;
    const res = await fetch(`/api/societies/${societyId}/admin`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setMsg(`Updated ${d.admin.email}.`);
    load();
  }

  return (
    <div className="mt-6 border-t border-slate-100 pt-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Admin access (login email & password)</h4>
      {admins.length === 0 && <p className="text-sm text-slate-400">No Society-admin account found.</p>}
      {admins.map((a) => (
        <div key={a._id} className="mb-2 grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="label">Login email</label>
            <input className="input" value={edits[a._id]?.email ?? ""} onChange={(e) => setEdits({ ...edits, [a._id]: { ...edits[a._id], email: e.target.value } })} />
          </div>
          <div>
            <label className="label">New password <span className="font-normal text-slate-400">(leave blank to keep)</span></label>
            <input className="input" type="password" placeholder="••••••" value={edits[a._id]?.password ?? ""} onChange={(e) => setEdits({ ...edits, [a._id]: { ...edits[a._id], password: e.target.value } })} />
          </div>
          <div className="flex items-end">
            <button className="btn-primary" onClick={() => save(a._id)}>Update</button>
          </div>
        </div>
      ))}
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
