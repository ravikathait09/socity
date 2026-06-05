"use client";
import { useEffect, useState } from "react";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [units, setUnits] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(null); // user being edited
  const blank = { name: "", email: "", password: "", roleIds: [], unitId: "", scopeBlocks: [] };
  const [form, setForm] = useState(blank);

  async function load() {
    const [u, r, un, bl] = await Promise.all([
      fetch("/api/users").then((x) => x.json()),
      fetch("/api/roles").then((x) => x.json()),
      fetch("/api/units").then((x) => x.json()),
      fetch("/api/blocks").then((x) => x.json()),
    ]);
    if (u.users) setUsers(u.users);
    if (r.roles) setRoles(r.roles);
    if (un.units) setUnits(un.units);
    if (bl.blocks) setBlocks(bl.blocks);
  }
  useEffect(() => {
    load();
  }, []);

  function toggleRole(id) {
    setForm((f) => ({
      ...f,
      roleIds: f.roleIds.includes(id) ? f.roleIds.filter((x) => x !== id) : [...f.roleIds, id],
    }));
  }

  async function create(e) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setForm(blank);
    load();
  }

  async function saveEdit() {
    setErr("");
    const res = await fetch(`/api/users/${editing._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleIds: editing.roleIds, unitId: editing.unitId || null, scopeBlocks: editing.scopeBlocks || [] }),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setEditing(null);
    load();
  }

  async function toggleActive(u) {
    await fetch(`/api/users/${u._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    load();
  }

  async function remove(u) {
    if (!confirm(`Remove ${u.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${u._id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-slate-500">
          Create users, assign or remove roles, link residents to a unit, and deactivate access.
        </p>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Name</th>
              <th>Email</th>
              <th>Roles</th>
              <th>Towers</th>
              <th>Status</th>
              <th className="text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{u.name}</td>
                <td className="text-slate-500">{u.email}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length ? (
                      u.roles.map((r) => (
                        <span key={r} className="badge bg-brand-50 text-brand-700">{r}</span>
                      ))
                    ) : (
                      <span className="text-slate-400">no roles</span>
                    )}
                  </div>
                </td>
                <td>
                  {u.unitNumbers?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {u.unitNumbers.map((n) => (
                        <span key={n} className="badge bg-emerald-100 text-emerald-700">{n}</span>
                      ))}
                    </div>
                  ) : u.scopeBlocks?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {u.scopeBlocks.map((c) => (
                        <span key={c} className="badge bg-indigo-100 text-indigo-700">Tower {c}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">all towers</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${u.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                    {u.active ? "active" : "disabled"}
                  </span>
                </td>
                <td className="pr-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="btn-ghost text-xs" onClick={() => setEditing({ ...u, unitId: u.unitId || "", scopeBlocks: u.scopeBlocks || [] })}>
                      Edit roles
                    </button>
                    <button className="btn-ghost text-xs" onClick={() => toggleActive(u)}>
                      {u.active ? "Disable" : "Enable"}
                    </button>
                    <button className="btn-ghost text-xs text-red-600" onClick={() => remove(u)}>
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create user */}
      <form onSubmit={create} className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Add a user</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" type="password" placeholder="Temp password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="input" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
            <option value="">No unit (staff)</option>
            {units.map((u) => (
              <option key={u._id} value={u._id}>{u.number}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Roles</label>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <button
                type="button"
                key={r._id}
                onClick={() => toggleRole(r._id)}
                className={`badge cursor-pointer ${
                  form.roleIds.includes(r._id) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Tower scope <span className="font-normal text-slate-400">(none = whole society / owner)</span></label>
          <div className="flex flex-wrap gap-2">
            {blocks.map((bl) => {
              const on = form.scopeBlocks.includes(bl.code);
              return (
                <button
                  type="button"
                  key={bl._id}
                  onClick={() => setForm((f) => ({ ...f, scopeBlocks: on ? f.scopeBlocks.filter((x) => x !== bl.code) : [...f.scopeBlocks, bl.code] }))}
                  className={`badge cursor-pointer ${on ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  Tower {bl.code}
                </button>
              );
            })}
          </div>
        </div>
        <button className="btn-primary">Create user</button>
      </form>

      {editing && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={() => setEditing(null)}>
          <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing.name}</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <label className="label">Roles</label>
            <div className="mb-4 flex flex-wrap gap-2">
              {roles.map((r) => {
                const on = editing.roleIds.includes(r._id);
                return (
                  <button
                    key={r._id}
                    onClick={() =>
                      setEditing((ed) => ({
                        ...ed,
                        roleIds: on ? ed.roleIds.filter((x) => x !== r._id) : [...ed.roleIds, r._id],
                      }))
                    }
                    className={`badge cursor-pointer ${on ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
            <label className="label">Linked unit</label>
            <select className="input mb-4" value={editing.unitId} onChange={(e) => setEditing({ ...editing, unitId: e.target.value })}>
              <option value="">No unit (staff)</option>
              {units.map((u) => (
                <option key={u._id} value={u._id}>{u.number}</option>
              ))}
            </select>
            <label className="label">Tower scope <span className="font-normal text-slate-400">(none = whole society)</span></label>
            <div className="mb-4 flex flex-wrap gap-2">
              {blocks.map((bl) => {
                const on = (editing.scopeBlocks || []).includes(bl.code);
                return (
                  <button
                    key={bl._id}
                    onClick={() =>
                      setEditing((ed) => ({
                        ...ed,
                        scopeBlocks: on ? ed.scopeBlocks.filter((x) => x !== bl.code) : [...(ed.scopeBlocks || []), bl.code],
                      }))
                    }
                    className={`badge cursor-pointer ${on ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    Tower {bl.code}
                  </button>
                );
              })}
            </div>
            <button className="btn-primary w-full" onClick={saveEdit}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
