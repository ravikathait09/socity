import { NextResponse } from "next/server";
import { requireSession, tenantFilter, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import Reimbursement from "@/models/Reimbursement";

// Download the bill/receipt attached to a reimbursement. Visible to reviewers
// (finance/chairman/pay/view_all) and to the claim's own requester.
export async function GET(req, { params }) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const { id } = await params;
  const r = await Reimbursement.findOne(tenantFilter(session, { _id: id })).lean();
  if (!r) return bad("Reimbursement not found", 404);

  const isOwner = String(r.requestedById) === String(session.uid);
  const canReview = ["reimburse.view_all", "reimburse.review", "reimburse.approve", "reimburse.pay"]
    .some((p) => hasPermission(session.permissions, p));
  if (!isOwner && !canReview) return bad("Forbidden", 403);
  if (!r.receipt?.contentBase64) return bad("No receipt on this claim", 404);

  const buf = Buffer.from(r.receipt.contentBase64, "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": r.receipt.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${r.receipt.name || "receipt"}"`,
    },
  });
}
