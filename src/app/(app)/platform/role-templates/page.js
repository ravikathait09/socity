"use client";
import { useEffect, useState } from "react";
import { PERMISSIONS } from "@/lib/rbac";

// Super admin edits the global role templates new societies are created from.
export default function RoleTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [sel, setSel] = useState(null); // selected template _id
  const [perms, setPerms] = useState(new Set());
  const [desc, setDesc] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [newName, setNewName] = useState("");

  async function load(keepSel) {
    const d = await fetch("/api/platform/role-templates").then((r) => r.json());
    if (d.templates) {
      setTemplates(d.templates);
      const pick = keepSel ? d.templates.find((t) => t._id === keepSel) : d.templates[0];
      if (pick) selectTpl(pick);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function selectTpl(t) {
    setSel(t._id);
    setPerms(new Set(t.permissions || []));
    setDesc(t.description || "");
    setMsg(""); setErr("");
  }

  // A feature is "granted" if held at full ("id") or view-only ("view:id").
  const held = (p, id) => p.has(id) || p.has("view:" + id);
  function toggle(id) {
    setPerms((p) => {
      const n = new Set(p);
      if (held(n, id)) { n.delete(id); n.delete("view:" + id); } // remove either variant
      else n.add(id); // grant full
      return n;
    });
  }

  async function save() {
    setErr(""); setMsg("");
    const res = await fetch(`/api/platform/role-templates/${sel}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: [...perms], description: desc }),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setMsg("Saved. New societies use this; sync existing ones from Societies.");
    load(sel);
  }

  async function addTemplate(e) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/platform/role-templates", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setNewName("");
    load(d.template._id);
  }

  async function del(t) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    const res = await fetch(`/api/platform/role-templates/${t._id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) return alert(d.error || "Failed");
    setSel(null);
    load();
  }

  const current = templates.find((t) => t._id === sel);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Role templates</h1>
        <p className="text-sm text-slate-500">
          Global role definitions. New societies are created with these roles; use <b>Sync roles</b> on the Societies page to push changes to existing tenants.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        {/* template list */}
        <div className="card p-3">
          <div className="space-y-1">
            {templates.map((t) => (
              <div key={t._id} className={`flex items-center justify-between rounded-lg px-2 py-1 ${sel === t._id ? "bg-brand-50" : "hover:bg-slate-50"}`}>
                <button className={`flex-1 text-left text-sm ${sel === t._id ? "font-medium text-brand-700" : "text-slate-600"}`} onClick={() => selectTpl(t)}>
                  {t.name}{t.system && <span className="ml-1 text-[10px] text-slate-400">built-in</span>}
                </button>
                {!t.system && <button className="text-xs text-red-500" onClick={() => del(t)}>✕</button>}
              </div>
            ))}
          </div>
          <form onSubmit={addTemplate} className="mt-3 border-t border-slate-100 pt-3">
            <input className="input mb-2 text-sm" placeholder="New role name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button className="btn-ghost w-full text-xs">+ Add template</button>
          </form>
        </div>

        {/* permission matrix */}
        <div className="card p-5">
          {!current ? <p className="text-sm text-slate-400">Select a template.</p> : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{current.name}</h2>
                <span className="text-xs text-slate-400">{perms.size} permissions</span>
              </div>
              <input className="input mb-4" placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <div className="space-y-4">
                {PERMISSIONS.map((group) => (
                  <div key={group.module}>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.module}</div>
                    <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                      {group.items.map((it) => (
                        <label key={it.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={held(perms, it.id)} onChange={() => toggle(it.id)} />
                          {it.label} <span className="text-[10px] text-slate-400">{it.id}{perms.has("view:" + it.id) ? " (view)" : ""}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3">
                <button className="btn-primary" onClick={save}>Save template</button>
                {msg && <span className="text-sm text-green-700">{msg}</span>}
                {err && <span className="text-sm text-red-600">{err}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
