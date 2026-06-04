import mongoose from "mongoose";

// A common-area expense for a period. splitRule decides how it is pro-rated
// across units when bills are generated.
const ExpenseSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    period: { type: String, required: true }, // "2026-05"
    category: String, // "Lift", "Security", "Water", ...
    categoryCode: String, // links to ExpenseCategory.code when chosen from the master
    description: String,
    amount: { type: Number, required: true },
    gstAmount: { type: Number, default: 0 }, // input GST on this expense, if any
    // Allocation tagging (Module 3): "all" towers vs "specific" tower(s).
    allocationType: { type: String, enum: ["all", "specific"], default: "all" },
    // equal -> split evenly across units; area -> by area; block -> only a block's units
    splitRule: { type: String, enum: ["equal", "area", "block"], default: "equal" },
    blockCode: String, // when splitRule === "block" (single tower)
    blockCodes: { type: [String], default: [] }, // when "specific" spans several towers
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedReason: String,
    // Who/how the bill was submitted, and the attached invoice (inline base64).
    vendorName: String,
    submittedVia: { type: String, enum: ["internal", "vendor-link"], default: "internal" },
    submittedByName: String,
    attachment: {
      name: String,
      mimeType: String,
      size: Number,
      contentBase64: String, // raw base64 (no data: prefix)
    },
  },
  { timestamps: true }
);

ExpenseSchema.index({ societyId: 1, period: 1 });

export default mongoose.models.Expense || mongoose.model("Expense", ExpenseSchema);
