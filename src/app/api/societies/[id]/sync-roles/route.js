import { authorize, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import { applyTemplatesToSociety } from "@/lib/roleTemplates";
import Society from "@/models/Society";

// Platform-level (super admin). Re-apply the current role templates to a society
// — refreshes its built-in roles to the latest permission set. Use this after
// adding new features/permissions so existing tenants get them without a reseed.
// (Users are bumped to re-login and pick up the new permissions.)
export async function POST(req, { params }) {
  const guard = await authorize("platform.onboard");
  if (guard.error) return guard.error;
  const { id } = await params;
  const society = await Society.findById(id).lean();
  if (!society) return bad("Society not found", 404);

  const roleByName = await applyTemplatesToSociety(id);
  await audit(guard.session, "society.sync_roles", `Synced roles to templates for "${society.name}"`, {
    entity: "Society",
    entityId: id,
    meta: { roles: Object.keys(roleByName) },
  });
  return ok({ ok: true, roles: Object.keys(roleByName) });
}
