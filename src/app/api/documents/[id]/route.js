import { NextResponse } from "next/server";
import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import DocumentModel from "@/models/Document";

// Download an inline document (or redirect to its external url).
export async function GET(req, { params }) {
  const guard = await authorize("admin.documents");
  if (guard.error) return guard.error;
  const { id } = await params;
  const doc = await DocumentModel.findOne(tenantFilter(guard.session, { _id: id })).lean();
  if (!doc) return bad("Document not found", 404);
  if (doc.url && !doc.contentBase64) return NextResponse.redirect(doc.url);
  if (!doc.contentBase64) return bad("No file content", 404);

  const buf = Buffer.from(doc.contentBase64, "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${doc.name}"`,
    },
  });
}

export async function DELETE(req, { params }) {
  const guard = await authorize("admin.documents");
  if (guard.error) return guard.error;
  const { id } = await params;
  const doc = await DocumentModel.findOneAndDelete(tenantFilter(guard.session, { _id: id }));
  if (!doc) return bad("Document not found", 404);
  await audit(guard.session, "document.delete", `Deleted document "${doc.name}"`, {
    entity: "Document",
    entityId: id,
  });
  return ok({ ok: true });
}
