import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";

// Route each user to the right home after login:
//   platform super admin -> platform dashboard
//   staff with dashboard  -> society dashboard
//   resident (has a flat) -> My account
//   anyone else           -> notice board
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.societyId) redirect("/platform/dashboard");
  if (hasPermission(session.permissions, "reports.dashboard")) redirect("/dashboard");
  if (session.hasUnit) redirect("/my-bills");
  redirect("/notices");
}
