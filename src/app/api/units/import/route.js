import bcrypt from "bcryptjs";
import { authorize, tenantFilter, isBlockScoped, ok, bad } from "@/lib/api";
import { audit } from "@/lib/audit";
import Unit from "@/models/Unit";
import User from "@/models/User";
import Role from "@/models/Role";

// Bulk import / update owners from a CSV (parsed client-side into rows).
// Keyed by flat number: existing flat -> owner updated (owner can be changed);
// missing flat -> created. With createUsers, an owner with an email gets a login
// (Owner role) — or, if that email already exists in this society, that user is
// assigned as the flat's owner. Gated by units.edit.
export async function POST(req) {
  const guard = await authorize("units.edit");
  if (guard.error) return guard.error;
  const { session } = guard;
  const b = await req.json().catch(() => ({}));
  const rows = Array.isArray(b.rows) ? b.rows : [];
  const createUsers = b.createUsers !== false; // default on
  if (rows.length === 0) return bad("No rows to import");

  // New owner logins get this default password (admin can override per import).
  const defaultPassword = (b.defaultPassword && String(b.defaultPassword).length >= 6) ? String(b.defaultPassword) : "Welcome@123";
  const ownerRole = await Role.findOne(tenantFilter(session, { name: "Owner" })).lean();
  const defaultHash = await bcrypt.hash(defaultPassword, 10);

  const res = { unitsCreated: 0, unitsUpdated: 0, usersCreated: 0, usersAssigned: 0, errors: [], defaultPassword };

  for (const [i, raw] of rows.entries()) {
    const number = String(raw.number || "").trim();
    if (!number) { res.errors.push(`Row ${i + 1}: missing flat number`); continue; }

    // tower scope guard for tower-scoped admins
    const blockCode = raw.blockCode ? String(raw.blockCode).trim() : undefined;
    if (isBlockScoped(session) && blockCode && !session.scopeBlocks.includes(blockCode)) {
      res.errors.push(`Row ${i + 1} (${number}): tower ${blockCode} outside your scope`); continue;
    }

    // upsert the unit's owner fields (keyed by flat number)
    const set = {
      societyId: session.societyId,
      number,
      ownerName: raw.ownerName || undefined,
      ownerPhone: raw.ownerPhone || undefined,
      ownerEmail: raw.ownerEmail ? String(raw.ownerEmail).toLowerCase().trim() : undefined,
    };
    if (blockCode) set.blockCode = blockCode;
    if (raw.areaSqft) set.areaSqft = Number(raw.areaSqft) || undefined;
    if (raw.bhk) set.bhk = raw.bhk;
    if (raw.waterInlets) set.waterInlets = Number(raw.waterInlets) || undefined;
    if (raw.monthlyMaintenance) set.monthlyMaintenance = Number(raw.monthlyMaintenance) || undefined;

    const existing = await Unit.findOne(tenantFilter(session, { number })).lean();
    if (isBlockScoped(session) && existing && !session.scopeBlocks.includes(existing.blockCode)) {
      res.errors.push(`Row ${i + 1} (${number}): outside your tower(s)`); continue;
    }
    const unit = await Unit.findOneAndUpdate(
      tenantFilter(session, { number }),
      set,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    existing ? res.unitsUpdated++ : res.unitsCreated++;

    // create / assign the owner's login
    if (createUsers && set.ownerEmail) {
      if (!ownerRole) { res.errors.push(`Row ${i + 1}: "Owner" role not found — user not created`); continue; }
      const existingUser = await User.findOne({ email: set.ownerEmail }).lean();
      if (existingUser) {
        if (String(existingUser.societyId) !== String(session.societyId)) {
          res.errors.push(`Row ${i + 1}: ${set.ownerEmail} belongs to another society`); continue;
        }
        // ADD this flat to the owner (one owner can hold several flats)
        const roleIds = [...new Set([...(existingUser.roleIds || []).map(String), String(ownerRole._id)])];
        await User.updateOne({ _id: existingUser._id }, {
          $set: { active: true, roleIds, unitId: existingUser.unitId || unit._id },
          $addToSet: { unitIds: unit._id },
          $inc: { permVersion: 1 },
        });
        res.usersAssigned++;
      } else {
        await User.create({
          societyId: session.societyId,
          name: set.ownerName || number,
          email: set.ownerEmail,
          passwordHash: defaultHash, // default password (owner should change it after first login)
          roleIds: [ownerRole._id],
          unitId: unit._id,
          unitIds: [unit._id],
          active: true,
        });
        res.usersCreated++;
      }
    }
  }

  await audit(session, "unit.import", `Imported owners: ${res.unitsCreated} new, ${res.unitsUpdated} updated, ${res.usersCreated} logins, ${res.usersAssigned} assigned`, {
    entity: "Unit",
    meta: res,
  });
  return ok(res);
}
