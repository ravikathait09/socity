import { requireSession, ok, bad } from "@/lib/api";
import Notification from "@/models/Notification";

// Mark a single notification read.
export async function PATCH(req, { params }) {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  const { id } = await params;
  const n = await Notification.findOneAndUpdate(
    { _id: id, societyId: session.societyId, userId: session.uid },
    { read: true },
    { new: true }
  );
  if (!n) return bad("Notification not found", 404);
  return ok({ notification: n });
}
