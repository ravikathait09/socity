import { authorize, tenantFilter, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import Minutes from "@/models/Minutes";

export async function GET() {
  const guard = await authorize("admin.minutes");
  if (guard.error) return guard.error;
  const minutes = await Minutes.find(tenantFilter(guard.session))
    .sort({ meetingDate: -1, createdAt: -1 })
    .lean();
  return ok({ minutes });
}

export async function POST(req) {
  const guard = await authorize("admin.minutes");
  if (guard.error) return guard.error;
  const { session } = guard;
  const b = await req.json().catch(() => ({}));
  if (!b.title) return bad("title is required");
  const doc = await Minutes.create({
    societyId: session.societyId,
    title: b.title,
    meetingDate: b.meetingDate ? new Date(b.meetingDate) : undefined,
    body: b.body,
    attendees: Array.isArray(b.attendees)
      ? b.attendees
      : String(b.attendees || "").split(",").map((s) => s.trim()).filter(Boolean),
    postedById: session.uid,
    postedByName: session.name,
  });
  await audit(session, "minutes.post", `Recorded minutes "${doc.title}"`, {
    entity: "Minutes",
    entityId: doc._id,
  });
  return ok({ minutes: doc }, { status: 201 });
}
