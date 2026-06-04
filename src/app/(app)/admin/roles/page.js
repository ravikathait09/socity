"use client";
import { useEffect, useState } from "react";
import { PERMISSIONS, VIEW_PREFIX } from "@/lib/rbac";

// 3-state access for a permission id, derived from the role's permission list.
function levelOf(perms, id) {
  const set = new Set(perms);
  if (set.has(id)) return "full";
  if (set.has(VIEW_PREFIX + id)) return "view";
  return "none";
}

// Apply a level change to a permissions array.
function applyLevel(perms, id, level) {
  const next = perms.filter((p) => p !== id && p !== VIEW_PREFIX + id);
  if (level === "full") next.push(id);
  if (level === "view") next.push(VIEW_PREFIX + id);
  return next;
}

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await fetch("/api/roles").then((x) => x.json());
    if (r.roles) {
      setRoles(r.roles);
      if (!selected && r.roles[0]) {
        setSelected(r.roles[0]._id);
        setDraft(r.roles[0].permissions);
      }
    }
  }
  useEffect(() => {
    load();
  }, []);

  function select(role) {
    setSelected(role._id);
    setDraft(role.permissions);
    setMsg("");
  }

  async function save() {
    setMsg("");
    const res = await fetch(`/api/roles/${selected}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: draft }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "Failed");
    setMsg("Saved.");
    load();
  }

  const current = roles.find((r) => r._id === selected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Roles & access</h1>
        <p className="text-sm text-slate-500">
          Per-society roles. Toggle each feature: Full / View-only / None.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="card h-fit p-2">
          {roles.map((r) => (
            <button
              key={r._id}
              onClick={() => select(r)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                selected === r._id ? "bg-brand-50 font-medium text-brand-700" : "hover:bg-slate-50"
              }`}
            >
              <span>{r.name}</span>
              {r.system && <span className="badge bg-slate-100 text-slate-400">system</span>}
            </button>
          ))}
        </div>

        <div className="card p-5">
          {current ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{current.name}</h2>
                  <p className="text-sm text-slate-500">{current.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  {msg && <span className="text-sm text-slate-500">{msg}</span>}
                  <button className="btn-primary" onClick={save}>
                    Save changes
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                {PERMISSIONS.map((mod) => (
                  <div key={mod.module}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {mod.module}
                    </div>
                    <div className="space-y-1">
                      {mod.items.map((item) => {
                        const lvl = levelOf(draft, item.id);
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50"
                          >
                            <span className="text-sm">{item.label}</span>
                            <div className="flex gap-1">
                              {["none", "view", "full"].map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() => setDraft(applyLevel(draft, item.id, opt))}
                                  className={`rounded px-2 py-0.5 text-xs ${
                                    lvl === opt
                                      ? opt === "full"
                                        ? "bg-green-600 text-white"
                                        : opt === "view"
                                        ? "bg-amber-500 text-white"
                                        : "bg-slate-300 text-slate-700"
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  }`}
                                >
                                  {opt === "none" ? "–" : opt === "view" ? "View" : "Full"}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Select a role.</p>
          )}
        </div>
      </div>
    </div>
  );
}
