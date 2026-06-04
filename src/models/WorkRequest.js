import mongoose from "mongoose";

// Approval Workflow Engine (Module 4). A request (material purchase, service
// contract, repair work order, overtime, event budget, emergency) flows through
// a configurable multi-level approval chain before execution.
//
// Status lifecycle:
//   pending_l1  -> Level 1 (Finance) review
//   pending_l2  -> Level 2 (Chairman) review
//   approved    -> ready to execute
//   rejected    -> sent back with mandatory reason
//   completed   -> work done, bills attached, closed
const REQUEST_TYPES = [
  "material",   // Material Purchase Request
  "service",    // Service Contract Request
  "repair",     // Repair / Maintenance Work Order
  "overtime",   // Staff Overtime / Additional Manpower
  "event",      // Event / Festival Budget
  "emergency",  // Emergency Repair (fast-tracked)
];

const ActionSchema = new mongoose.Schema(
  {
    at: { type: Date, default: () => new Date() },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: String,
    action: String, // "raised", "l1_approved", "l2_approved", "rejected", "completed", "escalated"
    note: String,
  },
  { _id: false }
);

const WorkRequestSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    code: { type: String, required: true }, // "REQ-0001"
    type: { type: String, enum: REQUEST_TYPES, default: "material" },
    title: { type: String, required: true },
    description: String,
    // line items / quantity / estimated cost / vendor quote
    items: [{ name: String, qty: Number, estCost: Number }],
    estimatedCost: { type: Number, default: 0 },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
    vendorName: String,
    blockCode: String, // tower-scoped requests
    emergency: { type: Boolean, default: false }, // bypasses Level 1 (Society Manager only)
    // who raised it
    raisedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    raisedByName: String,
    // workflow
    levels: { type: Number, default: 2 }, // snapshot of society approval depth
    status: {
      type: String,
      enum: ["pending_l1", "pending_l2", "approved", "rejected", "completed"],
      default: "pending_l1",
    },
    financeRemark: String, // Finance budget remarks before forwarding
    chairmanCondition: String, // Chairman "approve with conditions" comment
    rejectedReason: String,
    // SLA / auto-escalation: reminder if a level isn't acted on within X days.
    escalateAfterDays: { type: Number, default: 3 },
    escalated: { type: Boolean, default: false },
    completionNote: String,
    completedAt: Date,
    history: { type: [ActionSchema], default: [] },
  },
  { timestamps: true }
);

WorkRequestSchema.index({ societyId: 1, createdAt: -1 });
WorkRequestSchema.statics.TYPES = REQUEST_TYPES;

export default mongoose.models.WorkRequest ||
  mongoose.model("WorkRequest", WorkRequestSchema);
