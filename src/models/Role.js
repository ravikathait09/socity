import mongoose from "mongoose";

// Roles are per-society (not global). A society admin can rename them or add
// custom roles. permissions[] holds feature strings like "billing.generate".
const RoleSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true },
    name: { type: String, required: true },
    description: String,
    permissions: { type: [String], default: [] },
    // System roles are seeded defaults; platform roles (Super admin) span tenants.
    system: { type: Boolean, default: false },
    platform: { type: Boolean, default: false },
  },
  { timestamps: true }
);

RoleSchema.index({ societyId: 1, name: 1 }, { unique: true });

export default mongoose.models.Role || mongoose.model("Role", RoleSchema);
