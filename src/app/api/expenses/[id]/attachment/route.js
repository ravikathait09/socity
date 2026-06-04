import { NextResponse } from "next/server";
import { authorize, tenantFilter, bad } from "@/lib/api";
import Expense from "@/models/Expense";

// Download the invoice attached to an expense. Viewing is gated by expenses.ledger.
export async function GET(req, { params }) {
  const guard = await authorize("expenses.ledger");
  if (guard.error) return guard.error;
  const { id } = await params;
  const expense = await Expense.findOne(tenantFilter(guard.session, { _id: id })).lean();
  if (!expense?.attachment?.contentBase64) return bad("No invoice on this expense", 404);

  const buf = Buffer.from(expense.attachment.contentBase64, "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": expense.attachment.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${expense.attachment.name || "invoice"}"`,
    },
  });
}
