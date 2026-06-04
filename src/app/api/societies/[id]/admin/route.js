import bcrypt from "bcryptjs";
import { authorize, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import Society from "@/models/Society";
import Role from "@/models/Role";
import User from "@/models/User";

// Platform-level (super admin). Manage a tenant's Society-admin accounts —
// reset email / password / name. NOT tenant-scoped, but every action is pinned
// to the society in the path.
export async function GET(req, { params }) {
  const guard = await authorize("platform.onboard");
  if (guard.error) return guard.error;
  const { id } = await params;
  const society = await Society.findById(id).lean();
  if (!society) return bad("Society not found", 404);

  const adminRole = await Role.findOne({ societyId: id, name: "Society admin" }).lean();
  const admins = adminRole
    ? await User.find({ societyId: id, roleIds: adminRole._id }).select("name email active").sort({ createdAt: 1 }).lean()
    : [];
  return ok({ society: { _id: society._id, name: society.name }, admins });
}

// Update a Society-admin's credentials. Body: { userId, email?, password?, name? }
export async function PATCH(req, { params }) {
  const guard = await authorize("platform.onboard");
  if (guard.error) return guard.error;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (!b.userId) return bad("userId is required");

  // the target user MUST belong to the society in the path
  const user = await User.findOne({ _id: b.userId, societyId: id });
  if (!user) return bad("Admin user not found for this society", 404);

  if (b.email != null && b.email !== "") user.email = String(b.email).toLowerCase().trim();
  if (b.name != null && b.name !== "") user.name = b.name;
  if (b.password) {
    if (String(b.password).length < 6) return bad("Password must be at least 6 characters");
    user.passwordHash = await bcrypt.hash(b.password, 10);
  }

  try {
    await user.save();
  } catch (e) {
    return bad(e.code === 11000 ? "That email is already in use" : e.message);
  }

  await audit(guard.session, "society.admin_reset", `Updated admin ${user.email} for society ${id}`, {
    entity: "User",
    entityId: user._id,
    meta: { fields: [b.email ? "email" : null, b.password ? "password" : null, b.name ? "name" : null].filter(Boolean) },
  });
  return ok({ admin: { _id: user._id, name: user.name, email: user.email, active: user.active } });
}
