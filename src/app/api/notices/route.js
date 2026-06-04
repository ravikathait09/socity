import { authorize, requireSession, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import Notice from "@/models/Notice";

// Any authenticated member can read the notice board.
export async function GET() {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const notices = await Notice.find(tenantFilter(session))
    .sort({ pinned: -1, createdAt: -1 })
    .lean();
  return ok({ notices });
}

// Posting is gated by admin.notice.
export async function POST(req) {
  const guard = await authorize("admin.notice");
  if (guard.error) return guard.error;
  const { session } = guard;
  const b = await req.json().catch(() => ({}));
  if (!b.title) return bad("title is required");
  const category = ["general", "circular", "urgent", "event", "agm"].includes(b.category) ? b.category : "general";
  const notice = await Notice.create({
    societyId: session.societyId,
    title: b.title,
    body: b.body,
    category,
    pinned: !!b.pinned || category === "agm",
    meetingDate: category === "agm" && b.meetingDate ? new Date(b.meetingDate) : undefined,
    agenda: category === "agm" && Array.isArray(b.agenda) ? b.agenda.filter(Boolean) : [],
    postedById: session.uid,
    postedByName: session.name,
  });
  await audit(session, "notice.post", `Posted ${category === "agm" ? "AGM notice" : "notice"} "${notice.title}"`, {
    entity: "Notice",
    entityId: notice._id,
  });
  // AGM notices are mandatory communications — fan out to all residents.
  if (category === "agm") {
    const { notifyByPermission } = await import("@/lib/notify");
    await notifyByPermission(session.societyId, "billing.view_own", {
      title: `AGM notice: ${notice.title}`,
      body: notice.meetingDate ? `Meeting on ${new Date(notice.meetingDate).toDateString()}` : undefined,
      kind: "notice",
      link: "/notices",
      entityId: notice._id,
    });
  }
  return ok({ notice }, { status: 201 });
}
