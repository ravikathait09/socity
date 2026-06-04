import User from "@/models/User";
import Role from "@/models/Role";
import Society from "@/models/Society";
import { signToken, setSessionCookie } from "@/lib/auth";

// Build the JWT session for a user and set the cookie. Shared by password login
// and OTP login so both issue identical sessions (societyId + permissions embedded).
export async function issueSession(user) {
  const roles = await Role.find({ _id: { $in: user.roleIds } }).lean();
  const permissions = [...new Set(roles.flatMap((r) => r.permissions))];
  const society = user.societyId ? await Society.findById(user.societyId).lean() : null;

  // A suspended tenant cannot sign in (platform may re-activate later).
  if (society && society.active === false) return { suspended: true };

  const token = await signToken({
    uid: String(user._id),
    name: user.name,
    email: user.email,
    societyId: user.societyId ? String(user.societyId) : null,
    societyName: society?.name || null,
    roles: roles.map((r) => r.name),
    permissions,
    permVersion: user.permVersion || 1,
    scopeBlocks: user.scopeBlocks || [],
  });
  await setSessionCookie(token);

  return {
    name: user.name,
    email: user.email,
    societyName: society?.name || "Platform",
    roles: roles.map((r) => r.name),
    permissions,
  };
}
