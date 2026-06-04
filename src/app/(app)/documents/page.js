"use client";
import { useEffect, useState } from "react";

function prettySize(n) {
  if (!n) return "—";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(2) + " MB";
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState([]);
  const [form, setForm] = useState({ name: "", category: "general", url: "" });
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await fetch("/api/documents").then((r) => r.json());
    if (d.documents) setDocs(d.documents);
  }
  useEffect(() => {
    load();
  }, []);

  function readFileAsBase64(f) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]); // strip data: prefix
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function upload(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const payload = { name: form.name || file?.name, category: form.category };
    if (file) {
      payload.contentBase64 = await readFileAsBase64(file);
      payload.mimeType = file.type;
      payload.name = form.name || file.name;
    } else if (form.url) {
      payload.url = form.url;
    } else {
      setBusy(false);
      return setErr("Choose a file or paste a link");
    }
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(d.error || "Failed");
    setForm({ name: "", category: "general", url: "" });
    setFile(null);
    e.target.reset?.();
    load();
  }

  async function remove(id) {
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Document vault</h1>
        <p className="text-sm text-slate-500">Bylaws, AGM records, agreements — upload a file (≤1.5 MB) or link.</p>
      </div>

      <form onSubmit={upload} className="card space-y-3 p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <input className="input" placeholder="Document name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Category (bylaws, agm…)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <input className="input" placeholder="…or paste a URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </div>
        <button className="btn-primary" disabled={busy}>{busy ? "Uploading…" : "Add document"}</button>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2">Name</th>
              <th>Category</th>
              <th>Size</th>
              <th>Uploaded by</th>
              <th className="text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d._id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{d.name}</td>
                <td><span className="badge bg-slate-100 text-slate-600">{d.category}</span></td>
                <td>{d.url ? "link" : prettySize(d.size)}</td>
                <td className="text-slate-500">{d.uploadedByName || "—"}</td>
                <td className="pr-4 text-right">
                  <div className="flex justify-end gap-2">
                    <a className="btn-ghost text-xs" href={`/api/documents/${d._id}`} target="_blank" rel="noreferrer">
                      {d.url ? "Open" : "Download"}
                    </a>
                    <button className="btn-ghost text-xs text-red-600" onClick={() => remove(d._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No documents yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
