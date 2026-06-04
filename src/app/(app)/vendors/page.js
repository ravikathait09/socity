"use client";
import { useEffect, useState } from "react";
import { hasPermission } from "@/lib/rbac";

function money(n) { return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }
function Stars({ value }) {
  const v = Math.round(value || 0);
  return <span className="text-amber-500">{"★".repeat(v)}<span className="text-slate-300">{"★".repeat(5 - v)}</span></span>;
}
const BLANK = {
  name: "", serviceCategory: "", contactPerson: "", phone: "", email: "", address: "",
  gstNumber: "", pan: "", bankAccount: "", ifsc: "", vendorType: "other", subTags: "", inChargeUserId: "",
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [perms, setPerms] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [filters, setFilters] = useState({ q: "", category: "", status: "", mine: false });
  const [err, setErr] = useState("");
  const [openVendor, setOpenVendor] = useState(null);

  const canRate = hasPermission(perms, "vendors.rate");
  const canContracts = hasPermission(perms, "vendors.contracts");
  const canManage = hasPermission(perms, "maintenance.vendors");

  async function load() {
    const qs = new URLSearchParams();
    if (filters.q) qs.set("q", filters.q);
    if (filters.category) qs.set("category", filters.category);
    if (filters.status) qs.set("status", filters.status);
    if (filters.mine) qs.set("mine", "1");
    const [d, me, us] = await Promise.all([
      fetch(`/api/vendors?${qs}`).then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/users/assignable").then((r) => r.json()).catch(() => ({})),
    ]);
    if (d.vendors) setVendors(d.vendors);
    if (me.session) setPerms(me.session.permissions || []);
    if (us.users) setUsers(us.users);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters]);

  async function add(e) {
    e.preventDefault();
    setErr("");
    const payload = { ...form, subTags: form.subTags ? form.subTags.split(",").map((s) => s.trim()).filter(Boolean) : [] };
    const res = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setForm(BLANK);
    load();
  }

  async function post(id, body) {
    await fetch(`/api/vendors/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    load();
  }
  async function patch(id, body) {
    await fetch(`/api/vendors/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    load();
  }
  async function remove(v) {
    if (!confirm(`Remove vendor ${v.name}?`)) return;
    await fetch(`/api/vendors/${v._id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vendor directory</h1>
          <p className="text-sm text-slate-500">Searchable, category-wise directory with contracts, ratings and a named person in-charge.</p>
        </div>
        <a className="btn-ghost text-xs" href="/api/reports/export?type=vendors" target="_blank" rel="noreferrer">Export register</a>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <input className="input w-48" placeholder="Search name / contact / tag" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <input className="input w-40" placeholder="Category" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} />
        <select className="input w-36" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="blacklisted">Blacklisted</option>
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.mine} onChange={(e) => setFilters({ ...filters, mine: e.target.checked })} /> My vendors</label>
      </div>

      {canManage && (
        <form onSubmit={add} className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
          <input className="input" placeholder="Vendor name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Service category" value={form.serviceCategory} onChange={(e) => setForm({ ...form, serviceCategory: e.target.value })} />
          <input className="input" placeholder="Contact person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="GSTIN" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
          <input className="input" placeholder="PAN (for TDS)" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
          <select className="input" value={form.vendorType} onChange={(e) => setForm({ ...form, vendorType: e.target.value })}>
            <option value="individual">Individual</option><option value="proprietorship">Proprietorship</option>
            <option value="pvt-ltd">Pvt Ltd</option><option value="llp">LLP</option><option value="other">Other</option>
          </select>
          <input className="input" placeholder="Bank A/C" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
          <input className="input" placeholder="IFSC" value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} />
          <input className="input" placeholder="Sub-tags (comma sep)" value={form.subTags} onChange={(e) => setForm({ ...form, subTags: e.target.value })} />
          <select className="input" value={form.inChargeUserId} onChange={(e) => setForm({ ...form, inChargeUserId: e.target.value })}>
            <option value="">In-charge…</option>
            {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          <div className="col-span-2 md:col-span-4">
            <button className="btn-primary">Add vendor</button>
            {err && <span className="ml-3 text-sm text-red-600">{err}</span>}
          </div>
        </form>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {vendors.map((v) => (
          <div key={v._id} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{v.name}</span>
                  <span className="text-xs font-mono text-slate-400">{v.code}</span>
                  {v.blacklisted && <span className="badge bg-red-100 text-red-700">blacklisted</span>}
                  {!v.active && !v.blacklisted && <span className="badge bg-slate-200 text-slate-500">inactive</span>}
                </div>
                <div className="text-xs text-slate-500">{v.serviceCategory || v.trade}{v.subTags?.length ? ` · ${v.subTags.join(", ")}` : ""}</div>
              </div>
              <div className="text-right text-xs">
                <Stars value={v.rating} />
                <div className="text-slate-400">{v.ratingCount || 0} rating{v.ratingCount === 1 ? "" : "s"}</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
              <span>👤 {v.contactPerson || "—"}</span>
              <span>📞 {v.phone || "—"}</span>
              <span>GSTIN {v.gstNumber || "—"}</span>
              <span>PAN {v.pan || "—"}</span>
              <span className="col-span-2">🧑‍💼 In-charge: {v.inChargeName || "unassigned"}</span>
              <span className="col-span-2">Paid this FY: {money(v.paidThisFY)}{v.pan ? "" : " · ⚠ no PAN for TDS"}</span>
            </div>
            {v.blacklistReason && <div className="mt-1 text-xs text-red-600">Reason: {v.blacklistReason}</div>}
            <div className="mt-3 flex flex-wrap gap-2">
              {canRate && !v.blacklisted && (
                <select className="input h-8 w-28 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) { post(v._id, { rating: Number(e.target.value) }); e.target.value = ""; } }}>
                  <option value="">Rate…</option>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}
                </select>
              )}
              {canManage && (
                <select className="input h-8 w-36 text-xs" value={v.inChargeUserId || ""} onChange={(e) => patch(v._id, { inChargeUserId: e.target.value })}>
                  <option value="">In-charge…</option>
                  {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
              )}
              {canContracts && (
                <button className="btn-ghost text-xs" onClick={() => setOpenVendor(openVendor === v._id ? null : v._id)}>Contracts</button>
              )}
              {canManage && (
                <>
                  <button className="btn-ghost text-xs text-red-600" onClick={() => post(v._id, v.blacklisted ? { blacklist: false } : { blacklist: true, reason: prompt("Blacklist reason:") || "unspecified" })}>
                    {v.blacklisted ? "Un-blacklist" : "Blacklist"}
                  </button>
                  <button className="btn-ghost text-xs text-red-600" onClick={() => remove(v)}>Remove</button>
                </>
              )}
            </div>
            {openVendor === v._id && canContracts && <Contracts vendor={v} users={users} />}
          </div>
        ))}
        {vendors.length === 0 && <p className="text-sm text-slate-400">No vendors match.</p>}
      </div>
    </div>
  );
}

// Inline contract / AMC manager for a vendor (Section 9.2).
function Contracts({ vendor, users }) {
  const [contracts, setContracts] = useState([]);
  const [form, setForm] = useState({ contractType: "annual-amc", value: "", startDate: "", endDate: "", paymentTerms: "monthly", slaTerms: "", serviceDescription: "", inChargeUserId: vendor.inChargeUserId || "" });
  const [err, setErr] = useState("");

  async function load() {
    const d = await fetch(`/api/contracts?vendorId=${vendor._id}`).then((r) => r.json());
    if (d.contracts) setContracts(d.contracts);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function add(e) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, vendorId: vendor._id, value: Number(form.value) || 0 }),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setForm({ ...form, value: "", startDate: "", endDate: "", slaTerms: "", serviceDescription: "" });
    load();
  }

  function expiringSoon(c) {
    if (!c.endDate) return false;
    return new Date(c.endDate).getTime() - Date.now() < 30 * 86400000;
  }

  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3">
      <form onSubmit={add} className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <select className="input h-8 text-xs" value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
          <option value="annual-amc">Annual AMC</option><option value="monthly">Monthly</option>
          <option value="per-visit">Per-visit</option><option value="one-time">One-time</option>
        </select>
        <input className="input h-8 text-xs" placeholder="Value ₹" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
        <input className="input h-8 text-xs" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <input className="input h-8 text-xs" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        <input className="input h-8 text-xs md:col-span-2" placeholder="SLA (e.g. 4h response)" value={form.slaTerms} onChange={(e) => setForm({ ...form, slaTerms: e.target.value })} />
        <select className="input h-8 text-xs" value={form.inChargeUserId} onChange={(e) => setForm({ ...form, inChargeUserId: e.target.value })}>
          <option value="">In-charge…</option>
          {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
        </select>
        <button className="btn-primary h-8 text-xs">Add contract</button>
      </form>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      <ul className="mt-2 space-y-1 text-xs">
        {contracts.map((c) => (
          <li key={c._id} className="flex items-center justify-between rounded bg-white px-2 py-1">
            <span>
              <span className="font-mono">{c.contractNo}</span> · {c.contractType} · {money(c.value)}
              {c.endDate && <span className={expiringSoon(c) ? "ml-2 text-red-600" : "ml-2 text-slate-400"}>ends {new Date(c.endDate).toLocaleDateString("en-IN")}{expiringSoon(c) ? " ⚠" : ""}</span>}
            </span>
            <span className="text-slate-400">{c.renewalStatus} · {c.inChargeName || "—"}</span>
          </li>
        ))}
        {contracts.length === 0 && <li className="text-slate-400">No contracts yet.</li>}
      </ul>
    </div>
  );
}
