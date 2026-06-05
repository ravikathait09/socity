"use client";
import { useEffect, useState } from "react";
import { hasPermission } from "@/lib/rbac";

export default function UnitsPage() {
  const [units, setUnits] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [perms, setPerms] = useState([]);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ number: "", blockId: "", ownerName: "", ownerPhone: "", areaSqft: "", bhk: "", waterInlets: 1, monthlyMaintenance: "", meterNo: "", occupancy: "owner" });
  const [filterBlock, setFilterBlock] = useState("");
  const [canEdit, setCanEdit] = useState(true);

  // tower management
  const canConfig = hasPermission(perms, "units.block_config");
  const blankBlock = { code: "", name: "", totalFloors: "", amenities: "" };
  const [blockForm, setBlockForm] = useState(blankBlock);
  const [blockErr, setBlockErr] = useState("");
  const [editingBlock, setEditingBlock] = useState(null);

  // CSV owner import
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [defaultPassword, setDefaultPassword] = useState("Welcome@123");

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
    const payload = { code: e.code, name: e.name, totalFloors: e.totalFloors ? Number(e.totalFloors) : null, amenities: typeof e.amenities === "string" ? e.amenities.split(",").map((s) => s.trim()).filter(Boolean) : (e.amenities || []) };
    const res = await fetch(`/api/blocks/${e._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await res.json();
    if (!res.ok) return setBlockErr(d.error || "Failed");
    setEditingBlock(null);
    load();
  }

  // ---- CSV owner import ----
  const SAMPLE = "flat_number,owner_name,owner_phone,owner_email,block,area_sqft,bhk,water_inlets,monthly_maintenance\nA-101,Ramesh Kumar,9876500001,ramesh@example.com,A,950,2BHK,2,\nA-102,Sita Sharma,9876500002,sita@example.com,A,1100,3BHK,3,2500\n";
  function downloadSample() {
    const blob = new Blob([SAMPLE], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "owners-sample.csv"; a.click();
  }
  const HEADER_MAP = {
    flat_number: "number", number: "number", flat: "number", unit: "number",
    owner_name: "ownerName", name: "ownerName",
    owner_phone: "ownerPhone", phone: "ownerPhone", mobile: "ownerPhone",
    owner_email: "ownerEmail", email: "ownerEmail",
    block: "blockCode", tower: "blockCode",
    area_sqft: "areaSqft", area: "areaSqft", bhk: "bhk",
    water_inlets: "waterInlets", inlets: "waterInlets",
    monthly_maintenance: "monthlyMaintenance", maintenance: "monthlyMaintenance",
  };
  // Split one CSV line, honouring "quoted, fields".
  function splitLine(line) {
    const out = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM (Excel exports)
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = splitLine(lines[0]).map((h) => HEADER_MAP[h.toLowerCase().trim()] || null);
    return lines.slice(1).map((l) => {
      const cells = splitLine(l);
      const row = {};
      headers.forEach((key, i) => { if (key && cells[i] !== undefined && cells[i] !== "") row[key] = cells[i]; });
      return row;
    }).filter((r) => r.number);
  }
  async function onImportFile(file) {
    if (!file) return;
    setImportBusy(true); setImportResult(null);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) { setImportBusy(false); setImportResult({ error: "No valid rows found (need a flat_number column)." }); return; }
    const res = await fetch("/api/units/import", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, createUsers: true, defaultPassword }),
    });
    const d = await res.json();
    setImportBusy(false);
    setImportResult(res.ok ? d : { error: d.error || "Failed" });
    if (res.ok) load();
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
    setForm({ number: "", blockId: "", ownerName: "", ownerPhone: "", areaSqft: "", bhk: "", waterInlets: 1, monthlyMaintenance: "", meterNo: "", occupancy: "owner" });
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

      {/* Import owners from CSV */}
      {hasPermission(perms, "units.edit") && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Import owners (CSV)</h2>
              <p className="text-xs text-slate-500">Bulk add/update flats by flat number. Existing flat → owner reassigned; new flat → created. Owners with an email get an Owner login with the default password below (ask them to change it after first sign-in).</p>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost text-xs" onClick={downloadSample}>⬇ Sample CSV</button>
              <button className="btn-ghost text-xs" onClick={() => setShowImport((v) => !v)}>{showImport ? "Close" : "Import"}</button>
            </div>
          </div>
          {showImport && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="mb-2 max-w-xs">
                <label className="label">Default password for new owners</label>
                <input className="input" value={defaultPassword} onChange={(e) => setDefaultPassword(e.target.value)} />
              </div>
              <input type="file" accept=".csv,text/csv" className="input" disabled={importBusy}
                onChange={(e) => onImportFile(e.target.files?.[0])} />
              {importBusy && <p className="mt-2 text-sm text-slate-500">Importing…</p>}
              {importResult && (
                importResult.error ? (
                  <p className="mt-2 text-sm text-red-600">{importResult.error}</p>
                ) : (
                  <div className="mt-2 text-sm text-slate-700">
                    <span className="badge bg-green-100 text-green-700">{importResult.unitsCreated} created</span>{" "}
                    <span className="badge bg-blue-100 text-blue-700">{importResult.unitsUpdated} updated</span>{" "}
                    <span className="badge bg-indigo-100 text-indigo-700">{importResult.usersCreated} logins</span>{" "}
                    <span className="badge bg-slate-100 text-slate-600">{importResult.usersAssigned} assigned</span>
                    {importResult.usersCreated > 0 && (
                      <span className="ml-2 text-xs text-slate-500">New owners' password: <code className="font-semibold">{importResult.defaultPassword}</code></span>
                    )}
                    {importResult.errors?.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-red-600">
                        {importResult.errors.slice(0, 10).map((er, i) => <li key={i}>{er}</li>)}
                        {importResult.errors.length > 10 && <li>…and {importResult.errors.length - 10} more</li>}
                      </ul>
                    )}
                  </div>
                )
              )}
              <p className="mt-2 text-xs text-slate-400">Columns: flat_number, owner_name, owner_phone, owner_email, block, area_sqft, bhk, water_inlets, monthly_maintenance. Only flat_number is required.</p>
            </div>
          )}
        </div>
      )}

      {/* Towers / blocks */}
      {canConfig ? (
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Towers / blocks <span className="font-normal text-slate-400">({blocks.length})</span></h2>
          </div>
          <form onSubmit={addBlock} className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <input className="input" placeholder="Code (A)" value={blockForm.code} onChange={(e) => setBlockForm({ ...blockForm, code: e.target.value })} />
            <input className="input" placeholder="Name (optional)" value={blockForm.name} onChange={(e) => setBlockForm({ ...blockForm, name: e.target.value })} />
            <input className="input" placeholder="Floors" value={blockForm.totalFloors} onChange={(e) => setBlockForm({ ...blockForm, totalFloors: e.target.value })} />
            <input className="input md:col-span-1" placeholder="Amenities (lift, pump…)" value={blockForm.amenities} onChange={(e) => setBlockForm({ ...blockForm, amenities: e.target.value })} />
            <button className="btn-primary">Add tower</button>
          </form>
          {blockErr && <p className="text-sm text-red-600">{blockErr}</p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-1">Code</th><th>Name</th><th>Floors</th><th>Units</th><th>Amenities</th><th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b._id} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{b.code}</td>
                  <td>{b.name || "—"}</td>
                  <td>{b.totalFloors ?? "—"}</td>
                  <td>{b.unitCount}</td>
                  <td className="text-slate-500">{(b.amenities || []).join(", ") || "—"}</td>
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
            <label className="label">Maintenance override ₹ <span className="font-normal text-slate-400">(optional)</span></label>
            <input className="input" value={form.monthlyMaintenance} onChange={(e) => setForm({ ...form, monthlyMaintenance: e.target.value })} placeholder="society default" />
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
          <div className="col-span-2 md:col-span-6 flex items-center gap-3">
            <button className="btn-primary">Add unit</button>
            <span className="text-xs text-slate-400">Owners are assigned via “Import owners (CSV)” above — that also creates their login.</span>
            {err && <span className="text-sm text-red-600">{err}</span>}
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
