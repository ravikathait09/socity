"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  async function load() {
    try {
      const d = await fetch("/api/notifications").then((r) => r.json());
      if (d.notifications) setItems(d.notifications);
      if (typeof d.unreadCount === "number") setUnread(d.unreadCount);
    } catch {}
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // light poll
    return () => clearInterval(t);
  }, []);

  // close on outside click
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAll() {
    await fetch("/api/notifications", { method: "POST" });
    setUnread(0);
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
  }

  return (
    <div className="relative" ref={ref}>
      <button className="relative rounded-lg px-2 py-1 text-lg hover:bg-slate-50" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button className="text-xs text-brand-600 hover:underline" onClick={markAll}>Mark all read</button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-400">No notifications.</p>}
            {items.map((n) => (
              <Link
                key={n._id}
                href={n.link || "#"}
                onClick={() => setOpen(false)}
                className={`block border-b border-slate-50 px-3 py-2 text-sm hover:bg-slate-50 ${n.read ? "" : "bg-brand-50/40"}`}
              >
                <div className="font-medium text-slate-700">{n.title}</div>
                {n.body && <div className="text-xs text-slate-500">{n.body}</div>}
                <div className="mt-0.5 text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString("en-IN")}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Topbar({ name, roles, societyName, scopeBlocks = [] }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="text-sm text-slate-500">
        <span className="font-medium text-slate-700">{societyName}</span>
        <span className="mx-2">·</span>
        {scopeBlocks.length ? (
          <span className="badge bg-indigo-100 text-indigo-700">Tower {scopeBlocks.join(", ")}</span>
        ) : (
          "tenant-isolated workspace"
        )}
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="text-right">
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-slate-400">{(roles || []).join(", ")}</div>
        </div>
        <button onClick={logout} className="btn-ghost text-xs">
          Sign out
        </button>
      </div>
    </header>
  );
}
