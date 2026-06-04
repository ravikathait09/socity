import { requireSession, tenantFilter, blockScopedFilter, ok, bad } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notifyByPermission } from "@/lib/notify";
import Reimbursement from "@/models/Reimbursement";
import Society from "@/models/Society";

const MAX_INLINE_BYTES = 1.5 * 1024 * 1024;

// List reimbursements. reimburse.view_all/review/approve/pay -> all (tower-scoped);
// otherwise the user's own claims.
export async function GET() {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const canSeeAll = ["reimburse.view_all", "reimburse.review", "reimburse.approve", "reimburse.pay"]
    .some((p) => hasPermission(session.permissions, p));
  const canRaise = hasPermission(session.permissions, "reimburse.raise");
  if (!canSeeAll && !canRaise) return bad("Forbidden", 403);

  const filter = canSeeAll
    ? blockScopedFilter(session)
    : tenantFilter(session, { requestedById: session.uid });
  const reimbursements = await Reimbursement.find(filter)
    .select("-receipt.contentBase64")
    .sort({ createdAt: -1 })
    .lean();
  return ok({ reimbursements });
}

// Raise a reimbursement claim. Bill/receipt is mandatory.
export async function POST(req) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  if (!hasPermission(session.permissions, "reimburse.raise"))
    return bad('Forbidden — missing permission "reimburse.raise"', 403);

  const b = await req.json().catch(() => ({}));
  if (!b.amount || !b.description || !b.dateOfExpense)
    return bad("dateOfExpense, description and amount are required");
  if (!b.receipt?.contentBase64) return bad("A bill/receipt upload is mandatory");

  const size = Math.floor((b.receipt.contentBase64.length * 3) / 4);
  if (size > MAX_INLINE_BYTES) return bad("Receipt too large (max 1.5 MB)", 413);

  // Duplicate detection: same requester, amount & payee within 7 days.
  if (!b.confirmDuplicate) {
    const since = new Date(new Date(b.dateOfExpense).getTime() - 7 * 86400000);
    const until = new Date(new Date(b.dateOfExpense).getTime() + 7 * 86400000);
    const dup = await Reimbursement.findOne(tenantFilter(session, {
      requestedById: session.uid,
      amount: Number(b.amount),
      vendorPayee: b.vendorPayee,
      dateOfExpense: { $gte: since, $lte: until },
    })).lean();
    if (dup)
      return bad(`Possible duplicate of ${dup.code} (same amount & payee within 7 days). Resubmit with confirmDuplicate to proceed.`, 409);
  }

  // Role limit → flag over-limit claims (auto-escalate).
  const society = await Society.findById(session.societyId).lean();
  const limits = society?.settings?.reimbursementLimits;
  const primaryRole = (session.roles || [])[0];
  const limitVal = limits ? (limits instanceof Map ? limits.get(primaryRole) : limits[primaryRole]) : undefined;
  const overLimit = limitVal != null && Number(b.amount) > Number(limitVal);

  const count = await Reimbursement.countDocuments(tenantFilter(session));
  const code = `RMB-${String(count + 1).padStart(4, "0")}`;

  const r = await Reimbursement.create({
    societyId: session.societyId,
    code,
    requestedById: session.uid,
    requestedByName: session.name,
    requesterRole: primaryRole,
    dateOfExpense: new Date(b.dateOfExpense),
    category: b.category,
    categoryCode: b.categoryCode,
    description: b.description,
    amount: Number(b.amount),
    vendorPayee: b.vendorPayee,
    blockCode: b.blockCode,
    paymentModeUsed: ["cash", "upi", "bank"].includes(b.paymentModeUsed) ? b.paymentModeUsed : "cash",
    requesterBankUpi: b.requesterBankUpi,
    notes: b.notes,
    overLimit,
    receipt: {
      name: b.receipt.name || "receipt",
      mimeType: b.receipt.mimeType,
      size,
      contentBase64: b.receipt.contentBase64,
    },
    status: "submitted",
  });

  await audit(session, "reimbursement.raise", `Raised ${code}: ${r.description} ₹${r.amount}`, {
    entity: "Reimbursement",
    entityId: r._id,
  });
  await notifyByPermission(session.societyId, "reimburse.review", {
    title: `New reimbursement ${code} for review`,
    body: `${r.description} — ₹${r.amount}`,
    kind: "reimbursement",
    link: "/reimbursements",
    entityId: r._id,
  });
  const { receipt, ...lite } = r.toObject();
  return ok({ reimbursement: { ...lite, hasReceipt: true } }, { status: 201 });
}
