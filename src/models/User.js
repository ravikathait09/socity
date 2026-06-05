import mongoose from "mongoose";

// A user belongs to one society (platform super admins have societyId null).
// A user can hold multiple roles within that society.
const UserSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    roleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Role" }],
    // Units this resident owns/occupies. unitId is the PRIMARY flat (kept for
    // back-compat & for the single-flat resident screens); unitIds is the full
    // set so one owner can hold several flats.
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
    unitIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Unit", default: [] },
    // Tower/block scope: empty = whole society (owner/admin); otherwise this user
    // (e.g. a tower manager) may only act on data in these block codes.
    scopeBlocks: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    // bumped whenever this user's effective permissions change; the JWT carries a
    // snapshot, so a mismatch forces immediate re-login (see lib/api requireSession)
    permVersion: { type: Number, default: 1 },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });

export default mongoose.models.User || mongoose.model("User", UserSchema);
