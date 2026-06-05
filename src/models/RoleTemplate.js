import mongoose from "mongoose";

// Platform-level role template (Super admin owned, no societyId). New societies
// are onboarded with a Role copied from each template, and existing societies can
// be re-synced to them. Editing a template does NOT retroactively change a
// society until that society is synced.
const RoleTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    permissions: { type: [String], default: [] }, // expanded feature strings
    system: { type: Boolean, default: false }, // seeded defaults — editable, not deletable
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.RoleTemplate ||
  mongoose.model("RoleTemplate", RoleTemplateSchema);
