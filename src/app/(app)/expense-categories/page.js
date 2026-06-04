"use client";
import { useEffect, useState } from "react";

const BLANK = {
  name: "", code: "", allocationType: "all", budgetHead: "",
  gstApplicable: false, requiresApproval: true, approvalLevel: 2,
  parentCode: "", spendLimitPerMonth: "", sortOrder: 0,
};

export default function ExpenseCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [err, setErr] = useState("");

  async function load() {
    const d = await fetch("/api/expense-categories").then((r) => r.json());
    if (d.categories) setCategories(d.categories);
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/expense-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) return setErr(d.error || "Failed");
    setForm(BLANK);
    load();
  }

  async function patch(id, body) {
    await fetch(`/api/expense-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function remove(c) {
    if (!confirm(`Delete/deactivate "${c.name}"?`)) return;
    await fetch(`/api/expense-categories/${c._id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Expense categories</h1>
        <p className="text-sm text-slate-500">
          The dynamic category master. Drives expense dropdowns, GST handling, approval depth and budget heads — no code changes needed.
        </p>
      </div>

      <form onSubmit={add} className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lift Maintenance" />
        </div>
        <div>
          <label className="label">Code</label>
          <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="LIFT_MAINT" />
        </div>
        <div>
          <label className="label">Allocation</label>
          <select className="input" value={form.allocationType} onChange={(e) => setForm({ ...form, allocationType: e.target.value })}>
            <option value="all">All towers</option>
            <option value="specific">Tower-specific</option>
            <option value="both">Both (choose at entry)</option>
          </select>
        </div>
        <div>
          <label className="label">Budget head</label>
          <input className="input" value={form.budgetHead} onChange={(e) => setForm({ ...form, budgetHead: e.target.value })} placeholder="Repairs" />
        </div>
        <div>
          <label className="label">Approval level</label>
          <select className="input" value={form.approvalLevel} onChange={(e) => setForm({ ...form, approvalLevel: Number(e.target.value) })}>
            <option value={1}>1 — Finance only</option>
            <option value={2}>2 — Finance + Chairman</option>
          </select>
        </div>
        <div>
          <label className="label">Spend limit / month (₹)</label>
          <input className="input" value={form.spendLimitPerMonth} onChange={(e) => setForm({ ...form, spendLimitPerMonth: e.target.value })} />
        </div>
        <div>
          <label className="label">Parent code (optional)</label>
          <input className="input" value={form.parentCode} onChange={(e) => setForm({ ...form, parentCode: e.target.value })} placeholder="ELECTRICITY" />
        </div>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.gstApplicable} onChange={(e) => setForm({ ...form, gstApplicable: e.target.checked })} /> GST</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requiresApproval} onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })} /> Approval</label>
        </div>
        <div className="col-span-2 md:col-span-4">
          <button className="btn-primary">Add category</button>
          {err && <span className="ml-3 text-sm text-red-600">{err}</span>}
        </div>
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Name</th>
              <th>Code</th>
              <th>Allocation</th>
              <th>Budget head</th>
              <th>GST</th>
              <th>Approval</th>
              <th>Limit/mo</th>
              <th>Status</th>
              <th className="pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c._id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{c.name}{c.parentCode && <span className="ml-1 text-xs text-slate-400">↳ {c.parentCode}</span>}</td>
                <td className="font-mono text-xs">{c.code}</td>
                <td>{c.allocationType}</td>
                <td className="text-slate-500">{c.budgetHead || "—"}</td>
                <td>{c.gstApplicable ? "Yes" : "—"}</td>
                <td>{c.requiresApproval ? `L${c.approvalLevel}` : "none"}</td>
                <td>{c.spendLimitPerMonth ? `₹${c.spendLimitPerMonth.toLocaleString("en-IN")}` : "—"}</td>
                <td>
                  <span className={`badge ${c.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>{c.active ? "active" : "inactive"}</span>
                </td>
                <td className="pr-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="btn-ghost text-xs" onClick={() => patch(c._id, { active: !c.active })}>{c.active ? "Deactivate" : "Activate"}</button>
                    <button className="btn-ghost text-xs text-red-600" onClick={() => remove(c)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">No categories yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
