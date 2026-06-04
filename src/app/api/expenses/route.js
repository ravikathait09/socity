import { requireSession, tenantFilter, isBlockScoped, ok, bad } from "@/lib/api";
import { hasPermission, hasAny } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import Expense from "@/models/Expense";

const MAX_INLINE_BYTES = 1.5 * 1024 * 1024;

export async function GET(req) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  if (!hasPermission(session.permissions, "expenses.ledger"))
    return bad('Forbidden — missing permission "expenses.ledger"', 403);
  const period = new URL(req.url).searchParams.get("period");
  const filter = tenantFilter(session, period ? { period } : {});
  // tower-scoped users see common expenses (no blockCode) + their own tower's
  if (isBlockScoped(session)) {
    filter.$or = [
      { blockCode: { $in: session.scopeBlocks } },
      { blockCode: { $in: [null, ""] } },
      { blockCode: { $exists: false } },
    ];
  }
  // never ship the heavy base64 invoice in the list
  const expenses = await Expense.find(filter)
    .select("-attachment.contentBase64")
    .sort({ createdAt: -1 })
    .lean();
  return ok({ expenses });
}

// Add an expense / submit a bill. Allowed for expenses.add OR expenses.submit.
// Always created as "pending" — only an expenses.approve role makes it count.
export async function POST(req) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  if (!hasAny(session.permissions, ["expenses.add", "expenses.submit"]))
    return bad('Forbidden — missing permission "expenses.add" or "expenses.submit"', 403);

  const b = await req.json().catch(() => ({}));
  if (!b.period || !b.amount) return bad("period and amount are required");

  // Allocation tagging (Module 3): "all" towers vs "specific" tower(s).
  let allocationType = b.allocationType === "specific" ? "specific" : "all";
  let splitRule = b.splitRule || "equal";
  let blockCode = b.blockCode;
  let blockCodes = Array.isArray(b.blockCodes) ? b.blockCodes.filter(Boolean) : [];
  if (allocationType === "specific") {
    splitRule = "block";
    if (blockCodes.length === 0 && blockCode) blockCodes = [blockCode];
    if (blockCodes.length === 0) return bad("Select at least one tower for a tower-specific expense");
    blockCode = blockCodes[0];
  }
  // tower-scoped users can only file expenses against their own tower
  if (isBlockScoped(session)) {
    const bad1 = blockCodes.find((c) => !session.scopeBlocks.includes(c));
    if ((blockCode && !session.scopeBlocks.includes(blockCode)) || bad1)
      return bad("You can only file expenses for your assigned tower(s)", 403);
    blockCode = blockCode || session.scopeBlocks[0];
    blockCodes = blockCodes.length ? blockCodes : [blockCode];
    allocationType = "specific";
    splitRule = "block"; // their expenses are tower-specific, never society-common
  }

  let attachment;
  if (b.attachment?.contentBase64) {
    const size = Math.floor((b.attachment.contentBase64.length * 3) / 4);
    if (size > MAX_INLINE_BYTES) return bad("Invoice too large (max 1.5 MB)", 413);
    attachment = {
      name: b.attachment.name || "invoice",
      mimeType: b.attachment.mimeType,
      size,
      contentBase64: b.attachment.contentBase64,
    };
  }

  const expense = await Expense.create({
    societyId: session.societyId,
    period: b.period,
    category: b.category,
    categoryCode: b.categoryCode,
    description: b.description,
    amount: Number(b.amount),
    gstAmount: Number(b.gstAmount) || 0,
    allocationType,
    splitRule,
    blockCode,
    blockCodes,
    status: "pending",
    vendorName: b.vendorName,
    submittedVia: "internal",
    submittedByName: session.name,
    attachment,
  });
  await audit(session, "expense.submit", `Submitted bill "${expense.category || "expense"}" ₹${expense.amount} (${expense.period})${attachment ? " with invoice" : ""}`, {
    entity: "Expense",
    entityId: expense._id,
  });
  const { attachment: _a, ...lite } = expense.toObject();
  return ok({ expense: { ...lite, hasAttachment: !!attachment } }, { status: 201 });
}
