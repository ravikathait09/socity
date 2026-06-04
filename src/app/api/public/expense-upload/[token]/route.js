import { connectDB } from "@/lib/db";
import { ok, bad } from "@/lib/api";
import ExpenseUploadToken from "@/models/ExpenseUploadToken";
import Expense from "@/models/Expense";
import Society from "@/models/Society";
import AuditLog from "@/models/AuditLog";

const MAX_INLINE_BYTES = 1.5 * 1024 * 1024;

async function resolveToken(token) {
  await connectDB();
  const t = await ExpenseUploadToken.findOne({ token });
  if (!t) return { error: bad("Invalid link", 404) };
  if (t.usedAt) return { error: bad("This link has already been used", 410) };
  if (new Date() > new Date(t.expiresAt)) return { error: bad("This link has expired", 410) };
  return { t };
}

// Public: show what the vendor is being asked to submit (no login).
export async function GET(req, { params }) {
  const { token } = await params;
  const { t, error } = await resolveToken(token);
  if (error) return error;
  const society = await Society.findById(t.societyId).lean();
  return ok({
    society: society?.name || "Society",
    vendorName: t.vendorName,
    category: t.category,
    period: t.period,
    note: t.note,
    expiresAt: t.expiresAt,
  });
}

// Public: vendor submits the bill. Creates a PENDING expense scoped to the
// token's society; the link is then consumed. Approval is still done internally.
export async function POST(req, { params }) {
  const { token } = await params;
  const { t, error } = await resolveToken(token);
  if (error) return error;

  const b = await req.json().catch(() => ({}));
  if (!b.amount || !b.period) return bad("amount and period are required");

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
  if (!attachment) return bad("Please attach the invoice file");

  const expense = await Expense.create({
    societyId: t.societyId,
    period: b.period,
    category: b.category || t.category,
    description: b.description,
    amount: Number(b.amount),
    splitRule: b.splitRule || "equal",
    blockCode: b.blockCode,
    status: "pending",
    vendorName: t.vendorName || b.vendorName,
    submittedVia: "vendor-link",
    submittedByName: t.vendorName || "Vendor",
    attachment,
  });

  t.usedAt = new Date();
  t.createdExpenseId = expense._id;
  await t.save();

  // public submission has no session — log directly
  await AuditLog.create({
    societyId: t.societyId,
    actorName: `${t.vendorName || "Vendor"} (upload link)`,
    action: "expense.vendor_submit",
    summary: `Vendor submitted bill "${expense.category || "expense"}" ₹${expense.amount} (${expense.period}) — pending approval`,
    entity: "Expense",
    entityId: String(expense._id),
  });

  return ok({ ok: true, message: "Bill submitted. It will appear after the society approves it." }, { status: 201 });
}
