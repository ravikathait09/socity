import { requireSession, tenantFilter, ok, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notifyByPermission, notifyUsers } from "@/lib/notify";
import Reimbursement from "@/models/Reimbursement";

// Drive a reimbursement through its workflow. Body: { action, note, remark, paymentRef, paymentMode }
// actions: review | finance_approve | finance_reject | chairman_approve |
//          chairman_reject | pay | close | cancel
export async function PATCH(req, { params }) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const action = b.action;

  const r = await Reimbursement.findOne(tenantFilter(session, { _id: id }));
  if (!r) return bad("Reimbursement not found", 404);

  const isOwner = String(r.requestedById) === String(session.uid);
  const can = (p) => hasPermission(session.permissions, p);

  switch (action) {
    case "review":
      if (!can("reimburse.review")) return bad("Forbidden", 403);
      if (r.status !== "submitted") return bad("Only submitted claims can be opened for review", 409);
      r.status = "under_finance_review";
      break;

    case "finance_approve":
      if (!can("reimburse.review")) return bad("Forbidden", 403);
      if (!["submitted", "under_finance_review"].includes(r.status))
        return bad("Not awaiting finance review", 409);
      if (b.remark) r.financeRemark = b.remark;
      r.status = "finance_approved";
      break;

    case "finance_reject":
      if (!can("reimburse.review")) return bad("Forbidden", 403);
      if (!["submitted", "under_finance_review"].includes(r.status))
        return bad("Not awaiting finance review", 409);
      if (!b.note) return bad("A rejection reason is required");
      r.status = "rejected";
      r.rejectedStage = "finance";
      r.rejectedReason = b.note;
      break;

    case "chairman_approve":
      if (!can("reimburse.approve")) return bad("Forbidden", 403);
      if (r.status !== "finance_approved") return bad("Not awaiting chairman approval", 409);
      r.status = "chairman_approved";
      break;

    case "chairman_reject":
      if (!can("reimburse.approve")) return bad("Forbidden", 403);
      if (r.status !== "finance_approved") return bad("Not awaiting chairman approval", 409);
      if (!b.note) return bad("A rejection reason is required");
      r.status = "rejected";
      r.rejectedStage = "chairman";
      r.rejectedReason = b.note;
      break;

    case "pay":
      if (!can("reimburse.pay")) return bad("Forbidden", 403);
      if (r.status !== "chairman_approved") return bad("Only approved claims can be paid", 409);
      if (!b.paymentRef) return bad("A payment reference is required");
      r.status = "payment_processed";
      r.paymentRef = b.paymentRef;
      r.paymentMode = b.paymentMode || "bank";
      r.paidAt = new Date();
      r.paidById = session.uid;
      break;

    case "close":
      if (!isOwner) return bad("Only the requester can confirm receipt", 403);
      if (r.status !== "payment_processed") return bad("Payment not processed yet", 409);
      r.status = "closed";
      r.closedAt = new Date();
      break;

    case "cancel":
      if (!isOwner) return bad("Only the requester can cancel", 403);
      if (["payment_processed", "closed", "rejected", "cancelled"].includes(r.status))
        return bad("Too late to cancel", 409);
      r.status = "cancelled";
      break;

    default:
      return bad("Unknown action");
  }

  await r.save();
  await audit(session, `reimbursement.${action}`, `${action} ${r.code} → ${r.status}`, {
    entity: "Reimbursement",
    entityId: r._id,
  });

  // route notifications to the next actor / back to requester
  if (r.status === "finance_approved")
    await notifyByPermission(session.societyId, "reimburse.approve", {
      title: `${r.code} awaiting chairman approval`, body: `₹${r.amount} — ${r.description}`,
      kind: "reimbursement", link: "/reimbursements", entityId: r._id,
    });
  else if (r.status === "chairman_approved")
    await notifyByPermission(session.societyId, "reimburse.pay", {
      title: `${r.code} approved — ready for payout`, body: `₹${r.amount} to ${r.requestedByName}`,
      kind: "reimbursement", link: "/reimbursements", entityId: r._id,
    });
  else if (["rejected", "payment_processed"].includes(r.status) && r.requestedById)
    await notifyUsers(session.societyId, [r.requestedById], {
      title: `${r.code} ${r.status === "rejected" ? "rejected" : "paid"}`,
      body: r.status === "rejected" ? `Reason: ${r.rejectedReason}` : `Ref: ${r.paymentRef}`,
      kind: "reimbursement", link: "/reimbursements", entityId: r._id,
    });

  const { receipt, ...lite } = r.toObject();
  return ok({ reimbursement: { ...lite, hasReceipt: !!receipt?.contentBase64 } });
}
