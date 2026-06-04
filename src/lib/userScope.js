import Unit from "@/models/Unit";
import Role from "@/models/Role";
import { tenantFilter, isBlockScoped } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";

// Permissions a tower-scoped admin may NOT hand out (would escalate beyond their
// tower). Used to vet roleIds when a block-scoped admin creates / edits a user.
const ESCALATION = [
  "admin.roles", "admin.settings", "admin.users", "platform.onboard",
  "finance.legal", "billing.generate", "billing.penalty",
  "requests.approve_l2", "reimburse.approve", "reimburse.pay",
];

// Unit ids that live in the actor's tower(s) — residents are "in the tower" via
// their linked unit even though they carry no scopeBlocks.
export async function unitIdsInScope(session) {
  if (!isBlockScoped(session)) return null;
  const units = await Unit.find(
    tenantFilter(session, { blockCode: { $in: session.scopeBlocks } })
  ).select("_id").lean();
  return units.map((u) => u._id);
}

// Filter restricting a user list to the actor's tower(s). Society-wide admins
// (no scope) get the plain tenant filter. Block-scoped admins see staff scoped
// to their towers plus residents whose unit is in their towers.
export async function towerUserFilter(session) {
  if (!isBlockScoped(session)) return tenantFilter(session);
  const unitIds = await unitIdsInScope(session);
  return tenantFilter(session, {
    $or: [
      { scopeBlocks: { $in: session.scopeBlocks } },
      { unitId: { $in: unitIds } },
    ],
  });
}

// Validate that every requested role is assignable by this actor. Society-wide
// admins may assign anything in their society; tower admins may not grant
// escalating or platform roles.
export async function assertAssignableRoles(roleIds, session) {
  const roles = await Role.find(tenantFilter(session, { _id: { $in: roleIds } })).lean();
  if (roles.length !== roleIds.length) return { error: "One or more roles are not valid for this society" };
  if (isBlockScoped(session)) {
    for (const r of roles) {
      if (r.platform) return { error: `You cannot assign platform role "${r.name}"` };
      const escalates = ESCALATION.find((p) => hasPermission(r.permissions, p));
      if (escalates) return { error: `As a tower admin you cannot assign role "${r.name}" (it grants ${escalates})` };
    }
  }
  return { ids: roles.map((r) => r._id) };
}

// Resolve & constrain the scopeBlocks + unitId a block-scoped admin may set on a
// managed user. Staff get confined to the actor's towers; residents may be
// linked to a unit that sits in those towers.
export async function constrainScope(body, session) {
  if (!isBlockScoped(session)) {
    return { scopeBlocks: body.scopeBlocks, unitId: body.unitId };
  }
  // validate any unit link is within the actor's towers
  if (body.unitId) {
    const unit = await Unit.findOne(tenantFilter(session, { _id: body.unitId })).lean();
    if (!unit) return { error: "Unit not found" };
    if (!session.scopeBlocks.includes(unit.blockCode))
      return { error: "That unit is outside your assigned tower(s)" };
  }
  let scopeBlocks = Array.isArray(body.scopeBlocks) ? body.scopeBlocks : undefined;
  if (scopeBlocks !== undefined) {
    const outside = scopeBlocks.find((c) => !session.scopeBlocks.includes(c));
    if (outside) return { error: `Tower "${outside}" is outside your scope` };
  } else if (!body.unitId) {
    // a staff user with no explicit scope defaults to the admin's tower(s)
    scopeBlocks = session.scopeBlocks;
  }
  return { scopeBlocks, unitId: body.unitId };
}
