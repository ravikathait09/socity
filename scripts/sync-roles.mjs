// Refresh every society's built-in (system) roles to the CURRENT code defaults
// — WITHOUT wiping any data. Run after adding new permissions/roles in code:
//   npm run sync-roles
// Users are bumped so they pick up the new permissions on next sign-in.
import mongoose from "mongoose";
import Society from "../src/models/Society.js";
import Role from "../src/models/Role.js";
import User from "../src/models/User.js";
import { defaultRolePermissions } from "../src/lib/rbac.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/socity";

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to", MONGODB_URI);
  const defs = defaultRolePermissions();

  // 1) Platform role(s) (societyId null) — e.g. Super admin
  for (const [name, def] of Object.entries(defs)) {
    if (!def.platform) continue;
    await Role.findOneAndUpdate(
      { name, platform: true },
      { societyId: null, name, description: def.description, permissions: def.permissions, system: true, platform: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`platform role refreshed: ${name}`);
  }

  // 2) Each society's tenant roles
  const societies = await Society.find().lean();
  for (const s of societies) {
    let n = 0;
    for (const [name, def] of Object.entries(defs)) {
      if (def.platform) continue;
      await Role.findOneAndUpdate(
        { societyId: s._id, name },
        { societyId: s._id, name, description: def.description, permissions: def.permissions, system: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      n++;
    }
    // force everyone in this society to re-login so new perms take effect
    await User.updateMany({ societyId: s._id }, { $inc: { permVersion: 1 } });
    console.log(`${s.name}: ${n} roles synced`);
  }

  console.log("\nDone. Users must sign out & back in to pick up new permissions.");
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
