import { authorize, tenantFilter, ok } from "@/lib/api";
import AuditLog from "@/models/AuditLog";

export async function GET(req) {
  const guard = await authorize("reports.audit");
  if (guard.error) return guard.error;
  const limit = Math.min(500, Number(new URL(req.url).searchParams.get("limit")) || 200);
  const logs = await AuditLog.find(tenantFilter(guard.session))
    .sort({ at: -1 })
    .limit(limit)
    .lean();
  return ok({ logs });
}
