import { authorize, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import { ensureRoleTemplates } from "@/lib/roleTemplates";
import RoleTemplate from "@/models/RoleTemplate";

// Platform-level (super admin). Global role templates applied to new societies.
export async function GET() {
  const guard = await authorize("platform.onboard");
  if (guard.error) return guard.error;
  const templates = await ensureRoleTemplates();
  return ok({ templates });
}

export async function POST(req) {
  const guard = await authorize("platform.onboard");
  if (guard.error) return guard.error;
  const b = await req.json().catch(() => ({}));
  if (!b.name) return bad("name is required");
  try {
    const tpl = await RoleTemplate.create({
      name: b.name,
      description: b.description,
      permissions: Array.isArray(b.permissions) ? b.permissions : [],
      system: false,
      sortOrder: Number(b.sortOrder) || 99,
    });
    await audit(guard.session, "role_template.create", `Created role template "${tpl.name}"`, { entity: "RoleTemplate", entityId: tpl._id });
    return ok({ template: tpl }, { status: 201 });
  } catch (e) {
    return bad(e.code === 11000 ? "A template with that name exists" : e.message);
  }
}
