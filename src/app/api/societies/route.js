import bcrypt from "bcryptjs";
import { authorize, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import { defaultRolePermissions } from "@/lib/rbac";
import Society from "@/models/Society";
import Role from "@/models/Role";
import User from "@/models/User";

// Platform-level (super admin). NOT tenant-scoped.
export async function GET() {
  const guard = await authorize("platform.onboard");
  if (guard.error) return guard.error;
  const societies = await Society.find().sort({ createdAt: -1 }).lean();
  // attach a light user count per society
  for (const s of societies) {
    s.userCount = await User.countDocuments({ societyId: s._id });
  }
  return ok({ societies });
}

function slugify(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Onboard a new society: create the tenant, seed its default roles, and create
// the first Society admin user.
export async function POST(req) {
  const guard = await authorize("platform.onboard");
  if (guard.error) return guard.error;
  const b = await req.json().catch(() => ({}));
  if (!b.name || !b.adminEmail || !b.adminPassword)
    return bad("name, adminEmail and adminPassword are required");

  const slug = b.slug ? slugify(b.slug) : slugify(b.name);
  if (await Society.findOne({ slug })) return bad("A society with that slug already exists");
  if (await User.findOne({ email: b.adminEmail.toLowerCase() }))
    return bad("That admin email is already in use");

  const society = await Society.create({
    name: b.name,
    slug,
    city: b.city,
    registrationNo: b.registrationNo,
    ward: b.ward,
    blockMode: b.blockMode === "grouped" ? "grouped" : "standalone",
  });

  // seed society-scoped default roles (skip the global platform role)
  const defs = defaultRolePermissions();
  const roleByName = {};
  for (const [name, def] of Object.entries(defs)) {
    if (def.platform) continue;
    const role = await Role.create({
      societyId: society._id,
      name,
      description: def.description,
      permissions: def.permissions,
      system: true,
    });
    roleByName[name] = role;
  }

  const admin = await User.create({
    societyId: society._id,
    name: b.adminName || `${b.name} Admin`,
    email: b.adminEmail.toLowerCase(),
    passwordHash: await bcrypt.hash(b.adminPassword, 10),
    roleIds: [roleByName["Society admin"]._id],
    active: true,
  });

  await audit(guard.session, "society.onboard", `Onboarded society "${society.name}" (${slug}) with admin ${admin.email}`, {
    entity: "Society",
    entityId: society._id,
  });

  return ok(
    { society, admin: { email: admin.email, name: admin.name } },
    { status: 201 }
  );
}
