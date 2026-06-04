"use client";
import { useEffect, useState } from "react";
import { hasPermission } from "@/lib/rbac";

export default function UnitsPage() {
  const [units, setUnits] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [perms, setPerms] = useState([]);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ number: "", blockId: "", ownerName: "", ownerPhone: "", areaSqft: "", bhk: "", waterInlets: 1, meterNo: "", occupancy: "owner" });
  const [filterBlock, setFilterBlock] = useState("");
  const [canEdit, setCanEdit] = useState(true);

  // tower management
  const canConfig = hasPermission(perms, "units.block_config");
  const blankBlock = { code: "", name: "", totalFloors: "", mode: "standalone", groupName: "", amenities: "" };
  const [blockForm, setBlockForm] = useState(blankBlock);
  const [blockErr, setBlockErr] = useState("");
  const [editingBlock, setEditingBlock] = useState(null);

  async function load() {
    const [u, b, me] = await Promise.all([
      fetch("/api/units").then((r) => r.json()),
      fetch("/api/blocks").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ]);
    if (u.units) setUnits(u.units);
    if (b.blocks) setBlocks(b.blocks);
    if (me.session) setPerms(me.session.permissions || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function addBlock(e) {
    e.preventDefault();
    setBlockErr("");
    const payload = { ...blockForm, totalFloors: blockForm.totalFloors ? Number(blockForm.totalFloors) : undefined, amenities: blockForm.amenities ? blockForm.amenities.split(",").map((s) => s.trim()).filter(Boolean) : [] };
    const res = await fetch("/api/blocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await res.json();
    if (!res.ok) return setBlockErr(d.error || "Failed");
    setBlockForm(blankBlock);
    load();
  }

  async function saveBlock() {
    setBlockErr("");
    const e = editingBlock;
    const payload = { code: e.code, name: e.name, totalFloors: e.totalFloors ? Number(e.totalFloors) : null, mode: e.mode, groupName: e.groupName, amenities: typeof e.amenities === "string" ? e.amenities.split(",").map((s) => s.trim()).filter(Boolean) : (e.amenities || []) };
    const res = await fetch(`/api/blocks/${e._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await res.json();
    if (!res.ok) return setBlockErr(d.error || "Failed");
    setEditingBlock(null);
    load();
  }

  async function deleteBlock(b) {
    if (!confirm(`Delete tower ${b.code}?`)) return;
    const res = await fetch(`/api/blocks/${b._id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) return setBlockErr(d.error || "Failed");
    load();
  }

  async function addUnit(e) {
    e.preventDefault();
    setErr("");
    const block = blocks.find((b) => b._id === form.blockId);
    const res = await fetch("/api/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        blockId: form.blockId || undefined,
        blockCode: block?.code,
        areaSqft: Number(form.areaSqft) || undefined,
        waterInlets: Number(form.waterInlets) || 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403) setCanEdit(false);
      return setErr(data.error || "Failed");
    }
    setForm({ number: "", blockId: "", ownerName: "", ownerPhone: "", areaSqft: "", bhk: "", waterInlets: 1, meterNo: "", occupancy: "owner" });
    load();
  }

  const visibleUnits = filterBlock ? units.filter((u) => u.blockCode === filterBlock) : units;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Units & blocks</h1>
          <p className="text-sm text-slate-500">Unit registry — owners, tenants, meters.</p>
        </div>
        <div>
          <label className="label">Tower</label>
          <select className="input w-44" value={filterBlock} onChange={(e) => setFilterBlock(e.target.value)}>
            <option value="">All towers</option>
            {blocks.map((b) => (
              <option key={b._id} value={b.code}>
                {b.code}
                {b.name ? ` · ${b.name}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Towers / blocks */}
      {canConfig ? (
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Towers / blocks <span className="font-normal text-slate-400">({blocks.length})</span></h2>
          </div>
          <form onSubmit={addBlock} className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <input className="input" placeholder="Code (A)" value={blockForm.code} onChange={(e) => setBlockForm({ ...blockForm, code: e.target.value })} />
            <input className="input" placeholder="Name (optional)" value={blockForm.name} onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })} />
            <input className="input" placeholder="Floors" value={blockForm.totalFloors} onChange={(e) => setBlockForm({ ...blockForm, totalFloors: e.target.value })} />
            <select className="input" value={blockForm.mode} onChange={(e) => setBlockForm({ ...blockForm, mode: e.target.value })}>
              <option value="standalone">Standalone</option>
              <option value="grouped">Grouped</option>
            </select>
            <input className="input" placeholder="Group (A+B)" value={blockForm.groupName} onChange={(e) => setBlockForm({ ...blockForm, groupName: e.target.value })} />
            <button className="btn-primary">Add tower</button>
            <input className="input md:col-span-6" placeholder="Amenities (lift, pump, CCTV — comma separated)" value={blockForm.amenities} onChange={(e) => setBlockForm({ ...blockForm, amenities: e.target.value })} />
          </form>
          {blockErr && <p className="text-sm text-red-600">{blockErr}</p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-1">Code</th><th>Name</th><th>Floors</th><th>Units</th><th>Group</th><th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b._id} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{b.code}</td>
                  <td>{b.name || "—"}</td>
                  <td>{b.totalFloors ?? "—"}</td>
                  <td>{b.unitCount}</td>
                  <td className="text-slate-500">{b.groupName || b.mode}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost text-xs" onClick={() => setEditingBlock({ ...b, totalFloors: b.totalFloors ?? "", groupName: b.groupName || "", amenities: (b.amenities || []).join(", ") })}>Edit</button>
                      <button className="btn-ghost text-xs text-red-600" onClick={() => deleteBlock(b)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {blocks.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-slate-400">No towers yet — add one above.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {blocks.map((b) => (
            <span key={b._id} className="badge bg-slate-100 text-slate-600">
              Tower {b.code} · {b.unitCount} units {b.groupName ? `· ${b.groupName}` : ""}
            </span>
          ))}
        </div>
      )}

      {editingBlock && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={() => setEditingBlock(null)}>
          <div className="card w-full max-w-md space-y-3 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit tower {editingBlock.code}</h3>
              <button onClick={() => setEditingBlock(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Code</label><input className="input" value={editingBlock.code} onChange={(e) => setEditingBlock({ ...editingBlock, code: e.target.value })} /></div>
              <div><label className="label">Name</label><input className="input" value={editingBlock.name || ""} onChange={(e) => setEditingBlock({ ...editingBlock, name: e.target.value })} /></div>
              <div><label className="label">Floors</label><input className="input" value={editingBlock.totalFloors} onChange={(e) => setEditingBlock({ ...editingBlock, totalFloors: e.target.value })} /></div>
              <div><label className="label">Mode</label>
                <select className="input" value={editingBlock.mode} onChange={(e) => setEditingBlock({ ...editingBlock, mode: e.target.value })}>
                  <option value="standalone">Standalone</option><option value="grouped">Grouped</option>
                </select>
              </div>
              <div className="col-span-2"><label className="label">Group name</label><input className="input" value={editingBlock.groupName} onChange={(e) => setEditingBlock({ ...editingBlock, groupName: e.target.value })} /></div>
              <div className="col-span-2"><label className="label">Amenities (comma separated)</label><input className="input" value={editingBlock.amenities} onChange={(e) => setEditingBlock({ ...editingBlock, amenities: e.target.value })} /></div>
            </div>
            {blockErr && <p className="text-sm text-red-600">{blockErr}</p>}
            <button className="btn-primary w-full" onClick={saveBlock}>Save tower</button>
            <p className="text-xs text-slate-400">Renaming the code moves this tower's units with it.</p>
          </div>
        </div>
      )}

      {canEdit && (
        <form onSubmit={addUnit} className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-6">
          <div className="col-span-2 md:col-span-1">
            <label className="label">Unit no.</label>
            <input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="A-101" />
          </div>
          <div>
            <label className="label">Block</label>
            <select className="input" value={form.blockId} onChange={(e) => setForm({ ...form, blockId: e.target.value })}>
              <option value="">— Select tower —</option>
              {blocks.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.code}
                  {b.name ? ` · ${b.name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Owner</label>
            <input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
          </div>
          <div>
            <label className="label">Owner phone</label>
            <input className="input" value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} />
          </div>
          <div>
            <label className="label">Area (sqft)</label>
            <input className="input" value={form.areaSqft} onChange={(e) => setForm({ ...form, areaSqft: e.target.value })} />
          </div>
          <div>
            <label className="label">BHK</label>
            <input className="input" value={form.bhk} onChange={(e) => setForm({ ...form, bhk: e.target.value })} placeholder="2BHK" />
          </div>
          <div>
            <label className="label">Water inlets</label>
            <input className="input" value={form.waterInlets} onChange={(e) => setForm({ ...form, waterInlets: e.target.value })} />
          </div>
          <div>
            <label className="label">Occupancy</label>
            <select className="input" value={form.occupancy} onChange={(e) => setForm({ ...form, occupancy: e.target.value })}>
              <option value="owner">Owner</option><option value="tenant">Tenant</option><option value="vacant">Vacant</option>
            </select>
          </div>
          <div>
            <label className="label">Meter no.</label>
            <input className="input" value={form.meterNo} onChange={(e) => setForm({ ...form, meterNo: e.target.value })} />
          </div>
          <div className="col-span-2 md:col-span-6">
            <button className="btn-primary">Add unit</button>
            {err && <span className="ml-3 text-sm text-red-600">{err}</span>}
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Unit</th>
              <th>Block</th>
              <th>Owner</th>
              <th>Occupancy</th>
              <th>BHK</th>
              <th>Area</th>
              <th>Inlets</th>
              <th>Meter</th>
            </tr>
          </thead>
          <tbody>
            {visibleUnits.map((u) => (
              <tr key={u._id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{u.number}</td>
                <td>{u.blockCode || "—"}</td>
                <td>{u.ownerName || "—"}</td>
                <td>
                  <span className="badge bg-slate-100 text-slate-600">{u.occupancy}</span>
                </td>
                <td>{u.bhk || "—"}</td>
                <td>{u.areaSqft || "—"}</td>
                <td>{u.waterInlets ?? "—"}</td>
                <td>{u.meterNo || "—"}</td>
              </tr>
            ))}
            {visibleUnits.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  {filterBlock ? `No units in tower ${filterBlock}.` : "No units yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
