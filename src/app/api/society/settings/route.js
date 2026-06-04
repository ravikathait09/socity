import { requireSession, authorize, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import { buildSocietyUpdate } from "@/lib/societyUpdate";
import Society from "@/models/Society";

// Any member can read their society profile + settings (used to drive defaults).
export async function GET() {
  const session = await requireSession();
  if (!session) return bad("Unauthenticated", 401);
  if (!session.societyId) return ok({ society: null });
  const society = await Society.findById(session.societyId).lean();
  if (!society) return bad("Society not found", 404);
  return ok({ society });
}

// Editing profile + finance settings is gated by admin.settings.
export async function PATCH(req) {
  const guard = await authorize("admin.settings");
  if (guard.error) return guard.error;
  const { session } = guard;
  const b = await req.json().catch(() => ({}));
  const update = buildSocietyUpdate(b);

  const society = await Society.findByIdAndUpdate(session.societyId, update, { new: true }).lean();
  if (!society) return bad("Society not found", 404);
  await audit(session, "society.settings", `Updated society settings`, {
    entity: "Society",
    entityId: society._id,
    meta: { fields: Object.keys(update) },
  });
  return ok({ society });
}
