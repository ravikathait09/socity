import RoleTemplate from "@/models/RoleTemplate";
import Role from "@/models/Role";
import User from "@/models/User";
import { defaultRolePermissions } from "@/lib/rbac";

// Ensure the platform has role templates. On first use, seed them from the code
// defaults (all non-platform roles) so the Super admin has something to edit.
export async function ensureRoleTemplates() {
  const count = await RoleTemplate.countDocuments();
  if (count === 0) {
    const defs = defaultRolePermissions();
    let i = 0;
    for (const [name, def] of Object.entries(defs)) {
      if (def.platform) continue; // Super admin is platform-only, not a tenant role
      await RoleTemplate.create({
        name,
        description: def.description,
        permissions: def.permissions,
        system: true,
        sortOrder: i++,
      });
    }
  }
  return RoleTemplate.find().sort({ sortOrder: 1, name: 1 }).lean();
}

// Apply the current templates to a society's roles (upsert by name). Returns the
// name→Role map. Bumps permVersion for the society's users so the new
// permissions take effect on their next action (forces a token refresh).
export async function applyTemplatesToSociety(societyId) {
  const templates = await ensureRoleTemplates();
  const roleByName = {};
  for (const t of templates) {
    const role = await Role.findOneAndUpdate(
      { societyId, name: t.name },
      { societyId, name: t.name, description: t.description, permissions: t.permissions, system: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    roleByName[t.name] = role;
  }
  await User.updateMany({ societyId }, { $inc: { permVersion: 1 } });
  return roleByName;
}
