import { authorize, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import { buildSocietyUpdate } from "@/lib/societyUpdate";
import Society from "@/models/Society";
import User from "@/models/User";

// Platform-level (super admin) — NOT tenant-scoped. Read one tenant's full
// profile + settings + a light user count.
export async function GET(req, { params }) {
  const guard = await authorize("platform.onboard");
  if (guard.error) return guard.error;
  const { id } = await params;
  const society = await Society.findById(id).lean();
  if (!society) return bad("Society not found", 404);
  society.userCount = await User.countDocuments({ societyId: society._id });
  return ok({ society });
}

// Configure any tenant's profile / finance settings, or suspend / re-activate it.
export async function PATCH(req, { params }) {
  const guard = await authorize("platform.onboard");
  if (guard.error) return guard.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const update = buildSocietyUpdate(b);
  if (b.active !== undefined) update.active = !!b.active; // platform-only suspend/activate

  const society = await Society.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!society) return bad("Society not found", 404);
  await audit(guard.session, "society.platform_update", `Platform updated "${society.name}" (${Object.keys(update).join(", ")})`, {
    entity: "Society",
    entityId: society._id,
    meta: { fields: Object.keys(update), active: society.active },
  });
  return ok({ society });
}
