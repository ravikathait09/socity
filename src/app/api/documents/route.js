import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import DocumentModel from "@/models/Document";

const MAX_INLINE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB cap for inline uploads

export async function GET() {
  const guard = await authorize("admin.documents");
  if (guard.error) return guard.error;
  // exclude the heavy base64 payload from the listing
  const documents = await DocumentModel.find(tenantFilter(guard.session))
    .select("-contentBase64")
    .sort({ createdAt: -1 })
    .lean();
  return ok({ documents });
}

export async function POST(req) {
  const guard = await authorize("admin.documents");
  if (guard.error) return guard.error;
  const { session } = guard;
  const b = await req.json().catch(() => ({}));
  if (!b.name) return bad("name is required");
  if (!b.url && !b.contentBase64) return bad("Provide a url or upload a file");

  let size = b.size || 0;
  if (b.contentBase64) {
    size = Math.floor((b.contentBase64.length * 3) / 4); // approx decoded bytes
    if (size > MAX_INLINE_BYTES)
      return bad("File too large for inline upload (max 1.5 MB) — use a link instead", 413);
  }

  const doc = await DocumentModel.create({
    societyId: session.societyId,
    name: b.name,
    category: b.category || "general",
    url: b.url,
    contentBase64: b.contentBase64,
    mimeType: b.mimeType,
    size,
    uploadedById: session.uid,
    uploadedByName: session.name,
  });
  await audit(session, "document.upload", `Uploaded document "${doc.name}"`, {
    entity: "Document",
    entityId: doc._id,
  });
  const { contentBase64, ...meta } = doc.toObject();
  return ok({ document: meta }, { status: 201 });
}
