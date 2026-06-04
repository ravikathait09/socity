import mongoose from "mongoose";

// A maintenance complaint / work order. Residents raise; managers assign & close.
const MaintenanceRequestSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    code: { type: String, required: true }, // "WO-0001"
    title: { type: String, required: true },
    description: String,
    category: { type: String, default: "general" }, // plumbing, electrical, lift, ...
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    // who raised it
    raisedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    raisedByName: String,
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
    unitNumber: String,
    blockCode: String, // denormalized for tower-scoped visibility
    // optional photo evidence (inline base64, like Expense attachments)
    photo: {
      name: String,
      mimeType: String,
      size: Number,
      contentBase64: String,
    },
    // lifecycle
    status: { type: String, enum: ["open", "assigned", "in_progress", "resolved", "closed"], default: "open" },
    assignedVendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    assignedToName: String, // vendor or staff display name
    assignedAt: Date,
    resolvedAt: Date,
    closedAt: Date,
    resolutionNote: String,
    // SLA: configurable target hours; breach computed from createdAt vs resolvedAt/now.
    slaHours: Number,
    slaBreached: { type: Boolean, default: false },
    // resident feedback on resolution
    satisfactionRating: { type: Number, min: 1, max: 5 },
    satisfactionComment: String,
  },
  { timestamps: true }
);

MaintenanceRequestSchema.index({ societyId: 1, createdAt: -1 });

export default mongoose.models.MaintenanceRequest ||
  mongoose.model("MaintenanceRequest", MaintenanceRequestSchema);
