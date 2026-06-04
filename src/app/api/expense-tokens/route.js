import crypto from "node:crypto";
import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import ExpenseUploadToken from "@/models/ExpenseUploadToken";

// List recent vendor upload links (so staff can track / re-share).
export async function GET() {
  const guard = await authorize("expenses.submit");
  if (guard.error) return guard.error;
  const tokens = await ExpenseUploadToken.find(tenantFilter(guard.session))
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  // don't leak nothing sensitive here, but trim createdExpenseId noise
  return ok({ tokens });
}

// Create a single-use, expiring upload link for a vendor (no login required).
export async function POST(req) {
  const guard = await authorize("expenses.submit");
  if (guard.error) return guard.error;
  const { session } = guard;
  const b = await req.json().catch(() => ({}));

  const token = crypto.randomBytes(24).toString("base64url"); // ~32 chars, URL-safe
  const days = Math.min(30, Math.max(1, Number(b.expiresInDays) || 7));
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const doc = await ExpenseUploadToken.create({
    societyId: session.societyId,
    token,
    vendorName: b.vendorName,
    category: b.category,
    period: b.period,
    note: b.note,
    expiresAt,
    createdById: session.uid,
    createdByName: session.name,
  });
  await audit(session, "expense.token_create", `Created vendor upload link for ${b.vendorName || "vendor"} (expires ${expiresAt.toISOString().slice(0, 10)})`, {
    entity: "ExpenseUploadToken",
    entityId: doc._id,
  });
  return ok({ token: doc, path: `/vendor-upload/${token}` }, { status: 201 });
}
