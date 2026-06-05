"use client";
import { useEffect, useState } from "react";

import { currentPeriod } from "@/lib/period";

function money(n) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function readFile(f) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(f);
  });
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [err, setErr] = useState("");
  const [canApprove, setCanApprove] = useState(true);
  const BLANK = { category: "", categoryCode: "", amount: "", allocationType: "all", areaSplit: false, blockCodes: [], description: "", vendorName: "" };
  const [form, setForm] = useState(BLANK);
  const [file, setFile] = useState(null);
  const [showVendor, setShowVendor] = useState(false);

  const [categories, setCategories] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [vendors, setVendors] = useState([]);
  async function load() {
    const r = await fetch(`/api/expenses?period=${period}`).then((x) => x.json());
    if (r.expenses) setExpenses(r.expenses);
  }
  useEffect(() => {
    load();
  }, [period]);
  useEffect(() => {
    fetch("/api/expense-categories").then((x) => x.json()).then((d) => d.categories && setCategories(d.categories)).catch(() => {});
    fetch("/api/blocks").then((x) => x.json()).then((d) => d.blocks && setBlocks(d.blocks)).catch(() => {});
    fetch("/api/vendors/options").then((x) => x.json()).then((d) => d.vendors && setVendors(d.vendors)).catch(() => {});
  }, []);

  function toggleTower(code) {
    setForm((f) => ({
      ...f,
      blockCodes: f.blockCodes.includes(code) ? f.blockCodes.filter((c) => c !== code) : [...f.blockCodes, code],
    }));
  }

  async function add(e) {
    e.preventDefault();
    setErr("");
    if (!form.categoryCode) return setErr("Please choose an expense category");
    if (form.allocationType === "specific" && form.blockCodes.length === 0)
      return setErr("Pick at least one tower for a tower-specific expense");
    const payload = {
      category: form.category,
      categoryCode: form.categoryCode,
      description: form.description,
      vendorName: form.vendorName,
      period,
      amount: Number(form.amount),
      allocationType: form.allocationType,
      // all-tower: equal or by-area; tower-specific: split across the chosen tower(s)
      splitRule: form.allocationType === "specific" ? "block" : (form.areaSplit ? "area" : "equal"),
      blockCodes: form.allocationType === "specific" ? form.blockCodes : [],
    };
    if (file) payload.attachment = { name: file.name, mimeType: file.type, contentBase64: await readFile(file) };
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return setErr(data.error || "Failed");
    setForm(BLANK);
    setFile(null);
    e.target.reset?.();
    load();
  }

  // Change an expense's approval status (reversible). reject needs a reason.
  async function act(id, action) {
    const body = { action };
    if (action === "reject") {
      const reason = prompt("Reason for rejection (required):");
      if (!reason) return;
      body.reason = reason;
    }
    const res = await fetch(`/api/expenses/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 403) return setCanApprove(false);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Common expenses</h1>
          <p className="text-sm text-slate-500">
            Add or submit a bill (with invoice). Submitted bills stay <b>pending</b> until approved, then flow into billing.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="label">Period</label>
            <input className="input w-32" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <button className="btn-ghost" onClick={() => setShowVendor((v) => !v)}>
            Vendor upload link
          </button>
        </div>
      </div>

      {showVendor && <VendorLink period={period} />}

      {categories.filter((c) => c.active).length === 0 && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No expense categories yet. Create them under <b>Expense categories</b> first — every expense must be categorised.
        </div>
      )}

      <form onSubmit={add} className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-6">
        <div>
          <label className="label">Category <span className="text-red-500">*</span></label>
          <select
            className="input"
            value={form.categoryCode}
            onChange={(e) => {
              const match = categories.find((c) => c.code === e.target.value);
              setForm({ ...form, categoryCode: e.target.value, category: match?.name || "" });
            }}
          >
            <option value="">— choose category —</option>
            {categories.filter((c) => c.active).map((c) => (
              <option key={c._id} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Amount</label>
          <input className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <label className="label">Applies to</label>
          <select className="input" value={form.allocationType} onChange={(e) => setForm({ ...form, allocationType: e.target.value })}>
            <option value="all">All towers (common)</option>
            <option value="specific">Specific tower(s)</option>
          </select>
        </div>
        {form.allocationType === "all" ? (
          <div>
            <label className="label">Split</label>
            <select className="input" value={form.areaSplit ? "area" : "equal"} onChange={(e) => setForm({ ...form, areaSplit: e.target.value === "area" })}>
              <option value="equal">Equally per flat</option>
              <option value="area">By carpet area</option>
            </select>
          </div>
        ) : (
          <div className="col-span-2">
            <label className="label">Tower(s)</label>
            <div className="flex flex-wrap gap-2 pt-1">
              {blocks.map((b) => {
                const on = form.blockCodes.includes(b.code);
                return (
                  <button type="button" key={b._id} onClick={() => toggleTower(b.code)}
                    className={`badge cursor-pointer ${on ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    Tower {b.code}
                  </button>
                );
              })}
              {blocks.length === 0 && <span className="text-xs text-slate-400">No towers defined yet.</span>}
            </div>
          </div>
        )}
        <div>
          <label className="label">Vendor (optional)</label>
          <select className="input" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })}>
            <option value="">— none —</option>
            {vendors.map((v) => <option key={v._id} value={v.name}>{v.name}{v.serviceCategory ? ` · ${v.serviceCategory}` : ""}</option>)}
          </select>
          {vendors.length === 0 && <p className="mt-1 text-[11px] text-slate-400">No vendors yet — add them under Vendors.</p>}
        </div>
        <div>
          <label className="label">Invoice file</label>
          <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div className="col-span-2 md:col-span-6">
          <label className="label">Description</label>
          <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="col-span-2 flex items-end md:col-span-6">
          <button className="btn-primary">Submit bill</button>
          {err && <span className="ml-3 text-sm text-red-600">{err}</span>}
        </div>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Category</th>
              <th>Amount</th>
              <th>Split</th>
              <th>Source</th>
              <th>Invoice</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((x) => (
              <tr key={x._id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">
                  {x.category || "—"}
                  {x.description && <span className="ml-2 text-xs text-slate-400">{x.description}</span>}
                </td>
                <td>{money(x.amount)}</td>
                <td>
                  {x.allocationType === "specific" || x.splitRule === "block" ? (
                    <span className="badge bg-indigo-100 text-indigo-700">
                      Tower {(x.blockCodes?.length ? x.blockCodes : [x.blockCode]).filter(Boolean).join(", ")}
                    </span>
                  ) : (
                    <span className="text-slate-500">All · {x.splitRule === "area" ? "by area" : "equal"}</span>
                  )}
                </td>
                <td className="text-xs text-slate-500">
                  {x.submittedVia === "vendor-link" ? (
                    <span className="badge bg-purple-100 text-purple-700">vendor</span>
                  ) : (
                    "internal"
                  )}
                  {x.vendorName ? <span className="ml-1">· {x.vendorName}</span> : ""}
                </td>
                <td>
                  {x.attachment?.name ? (
                    <a className="text-brand-600 hover:underline" href={`/api/expenses/${x._id}/attachment`} target="_blank" rel="noreferrer">
                      📎 view
                    </a>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${x.status === "approved" ? "bg-green-100 text-green-700" : x.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {x.status}
                  </span>
                  {x.status === "rejected" && x.rejectedReason && (
                    <div className="text-[11px] text-red-500">{x.rejectedReason}</div>
                  )}
                </td>
                <td>
                  {canApprove && (
                    <div className="flex flex-wrap gap-1">
                      {x.status !== "approved" && (
                        <button className="btn-ghost text-xs text-green-700" onClick={() => act(x._id, "approve")}>Approve</button>
                      )}
                      {x.status !== "rejected" && (
                        <button className="btn-ghost text-xs text-red-600" onClick={() => act(x._id, "reject")}>Reject</button>
                      )}
                      {x.status !== "pending" && (
                        <button className="btn-ghost text-xs text-slate-500" onClick={() => act(x._id, "pending")}>Revert</button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No expenses for {period}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Generate a no-login upload link for a third-party vendor.
function VendorLink({ period }) {
  const [v, setV] = useState({ vendorName: "", category: "", expiresInDays: 7 });
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");

  async function create() {
    setErr("");
    setLink("");
    const res = await fetch("/api/expense-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...v, period }),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setLink(window.location.origin + d.path);
  }

  return (
    <div className="card space-y-3 p-4">
      <h2 className="text-sm font-semibold">Invite a vendor to upload a bill (no login)</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <input className="input" placeholder="Vendor name" value={v.vendorName} onChange={(e) => setV({ ...v, vendorName: e.target.value })} />
        <input className="input" placeholder="Category (e.g. Lift AMC)" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} />
        <input className="input" type="number" placeholder="Expires (days)" value={v.expiresInDays} onChange={(e) => setV({ ...v, expiresInDays: e.target.value })} />
        <button type="button" className="btn-primary" onClick={create}>Generate link</button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {link && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
          <code className="flex-1 truncate text-xs text-slate-700">{link}</code>
          <button type="button" className="btn-ghost text-xs" onClick={() => navigator.clipboard?.writeText(link)}>
            Copy
          </button>
        </div>
      )}
      <p className="text-xs text-slate-400">
        Single-use & expiring. The vendor opens the link, fills the amount and attaches the invoice — it arrives here as a <b>pending</b> bill for approval.
      </p>
    </div>
  );
}
