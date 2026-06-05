import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default async function AppLayout({ children }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        permissions={session.permissions}
        societyName={session.societyName || "Platform"}
        isPlatform={!session.societyId}
        hasUnit={!!session.hasUnit}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          name={session.name}
          roles={session.roles}
          societyName={session.societyName || "Platform"}
          scopeBlocks={session.scopeBlocks || []}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
