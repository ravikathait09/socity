import { NextResponse } from "next/server";
import { requireSession, tenantFilter, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import MaintenanceRequest from "@/models/MaintenanceRequest";

// View the photo attached to a complaint. Managers (maintenance.view_all) or the
// resident who raised it can see it.
export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const { id } = await params;
  const r = await MaintenanceRequest.findOne(tenantFilter(session, { _id: id })).lean();
  if (!r) return bad("Request not found", 404);
  const isOwner = String(r.raisedById) === String(session.uid);
  if (!isOwner && !hasPermission(session.permissions, "maintenance.view_all"))
    return bad("Forbidden", 403);
  if (!r.photo?.contentBase64) return bad("No photo on this request", 404);

  const buf = Buffer.from(r.photo.contentBase64, "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": r.photo.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${r.photo.name || "photo"}"`,
    },
  });
}
