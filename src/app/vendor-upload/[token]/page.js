"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function VendorUploadPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ amount: "", category: "", period: "", description: "" });
  const [file, setFile] = useState(null);

  useEffect(() => {
    fetch(`/api/public/expense-upload/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setErr(d.error);
        setInfo(d);
        setForm((f) => ({ ...f, category: d.category || "", period: d.period || "" }));
      })
      .catch((e) => setErr(String(e)));
  }, [token]);

  function readFile(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!file) return setErr("Please attach the invoice file");
    setBusy(true);
    const payload = {
      amount: Number(form.amount),
      category: form.category,
      period: form.period,
      description: form.description,
      attachment: { name: file.name, mimeType: file.type, contentBase64: await readFile(file) },
    };
    const res = await fetch(`/api/public/expense-upload/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(d.error || "Submission failed");
    setDone(d.message || "Submitted.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">S</div>
          <h1 className="text-xl font-semibold">Submit your bill</h1>
          {info && <p className="text-sm text-slate-500">for {info.society}</p>}
        </div>

        {err && !info ? (
          <div className="card p-6 text-center text-sm text-red-600">{err}</div>
        ) : done ? (
          <div className="card p-6 text-center">
            <div className="mb-2 text-3xl">✓</div>
            <p className="text-sm text-slate-700">{done}</p>
          </div>
        ) : info ? (
          <form onSubmit={submit} className="card space-y-3 p-6">
            {info.vendorName && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Vendor: <b>{info.vendorName}</b>
                {info.note ? <span className="block text-xs text-slate-400">{info.note}</span> : null}
              </p>
            )}
            <div>
              <label className="label">Bill amount (₹)</label>
              <input className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="24000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Lift AMC" />
              </div>
              <div>
                <label className="label">Period</label>
                <input className="input" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2026-05" />
              </div>
            </div>
            <div>
              <label className="label">Note (optional)</label>
              <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Invoice file (PDF/image, ≤1.5 MB)</label>
              <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button className="btn-primary w-full" disabled={busy}>{busy ? "Submitting…" : "Submit bill"}</button>
            <p className="text-center text-xs text-slate-400">
              Your bill will be reviewed and approved by the society before it is recorded.
            </p>
          </form>
        ) : (
          <div className="card p-6 text-center text-sm text-slate-400">Loading…</div>
        )}
      </div>
    </div>
  );
}
