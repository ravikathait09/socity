import { requireSession, ok, bad } from "@/lib/api";
import Notification from "@/models/Notification";

// List the current user's notifications (newest first). ?unread=1 for unread only.
export async function GET(req) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const unread = new URL(req.url).searchParams.get("unread");
  const filter = { societyId: session.societyId, userId: session.uid };
  if (unread) filter.read = false;
  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(50).lean(),
    Notification.countDocuments({ societyId: session.societyId, userId: session.uid, read: false }),
  ]);
  return ok({ notifications, unreadCount });
}

// Mark all as read.
export async function POST() {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  await Notification.updateMany(
    { societyId: session.societyId, userId: session.uid, read: false },
    { read: true }
  );
  return ok({ ok: true });
}
