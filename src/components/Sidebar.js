"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasPermission } from "@/lib/rbac";

// Nav items are gated by permission — the menu reflects the user's role.
// perm:null means visible to every authenticated member.
const NAV = [
  { href: "/dashboard", label: "Dashboard", perm: "reports.dashboard", icon: "▦" },
  { href: "/units", label: "Units & blocks", perm: "units.view", icon: "▣" },
  { href: "/meter-readings", label: "Meter readings", perm: "power.meter_readings", icon: "⚡" },
  { href: "/expenses", label: "Expenses", perm: "expenses.add", icon: "₹" },
  { href: "/expense-categories", label: "Expense categories", perm: "expenses.categories", icon: "🏷" },
  { href: "/approvals", label: "Approvals", perm: "requests.raise", icon: "✅" },
  { href: "/reimbursements", label: "Reimbursements", perm: "reimburse.raise", icon: "💸" },
  { href: "/billing", label: "Billing", perm: "billing.generate", icon: "🧾" },
  { href: "/payments", label: "Payments & dues", perm: "payments.record", icon: "💳" },
  { href: "/legal-finance", label: "Legal & finance", perm: "finance.legal", icon: "🏦" },
  { href: "/reports", label: "Reports & export", perm: "reports.export", icon: "📊" },
  { href: "/maintenance", label: "Maintenance", perm: "maintenance.raise", icon: "🔧" },
  { href: "/vendors", label: "Vendors", perm: "maintenance.vendors", icon: "🧰" },
  { href: "/notices", label: "Notice board", perm: null, icon: "📢" },
  { href: "/minutes", label: "Meeting minutes", perm: "admin.minutes", icon: "📝" },
  { href: "/documents", label: "Documents", perm: "admin.documents", icon: "📁" },
  { href: "/my-bills", label: "My bills", perm: "billing.view_own", icon: "📄" },
  { href: "/admin/users", label: "Users", perm: "admin.users", icon: "👥" },
  { href: "/admin/roles", label: "Roles & access", perm: "admin.roles", icon: "🛡" },
  { href: "/admin/settings", label: "Society settings", perm: "admin.settings", icon: "⚙️" },
  { href: "/admin/audit", label: "Audit log", perm: "reports.audit", icon: "🔎" },
  { href: "/platform", label: "Platform", perm: "platform.onboard", icon: "🏢" },
];

// Platform (super-admin) users have no society of their own, so they only get
// the tenant-management area — none of the operational society screens.
const PLATFORM_NAV = [
  { href: "/platform/dashboard", label: "Dashboard", perm: "platform.onboard", icon: "▦" },
  { href: "/platform", label: "Societies", perm: "platform.onboard", icon: "🏢" },
];

export default function Sidebar({ permissions, societyName, isPlatform = false }) {
  const pathname = usePathname();
  const source = isPlatform ? PLATFORM_NAV : NAV;
  const items = source.filter((n) => n.perm === null || hasPermission(permissions, n.perm));

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          S
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{societyName}</div>
          <div className="text-xs text-slate-400">Socity SaaS</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                active
                  ? "bg-brand-50 font-medium text-brand-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="w-5 text-center">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3 text-[11px] text-slate-400">
        Phase 3 · Reports & admin
      </div>
    </aside>
  );
}
