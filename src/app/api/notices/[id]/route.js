import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import Notice from "@/models/Notice";

export async function DELETE(req, { params }) {
  const guard = await authorize("admin.notice");
  if (guard.error) return guard.error;
  const { id } = await params;
  const notice = await Notice.findOneAndDelete(tenantFilter(guard.session, { _id: id }));
  if (!notice) return bad("Notice not found", 404);
  await audit(guard.session, "notice.delete", `Deleted notice "${notice.title}"`, {
    entity: "Notice",
    entityId: id,
  });
  return ok({ ok: true });
}
