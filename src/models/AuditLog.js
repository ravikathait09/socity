import mongoose from "mongoose";

// Append-only audit trail of mutating actions within a society.
// Written by lib/audit.js; viewable via reports.audit.
const AuditLogSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: String,
    action: { type: String, required: true }, // "payment.record", "user.create", ...
    summary: String, // human-readable one-liner
    entity: String, // "Bill", "User", ...
    entityId: String,
    meta: mongoose.Schema.Types.Mixed,
    at: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

AuditLogSchema.index({ societyId: 1, at: -1 });

export default mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
