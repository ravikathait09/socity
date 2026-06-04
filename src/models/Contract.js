import mongoose from "mongoose";

// Vendor contract / AMC (Module 12, Section 9.2). Tracks the agreement lifecycle,
// SLA terms, covered towers, the responsible society person and renewal status.
const ContractSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    contractNo: { type: String, required: true }, // system or manual reference
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true },
    vendorName: String,
    serviceDescription: String,
    contractType: { type: String, enum: ["one-time", "monthly", "annual-amc", "per-visit"], default: "annual-amc" },
    startDate: Date,
    endDate: Date, // renewal alert fires 30 days before this
    value: { type: Number, default: 0 },
    paymentTerms: { type: String, enum: ["monthly", "quarterly", "on-completion", "advance-balance"], default: "monthly" },
    blockCodes: { type: [String], default: [] }, // towers / areas covered
    slaTerms: String, // e.g. "lift fault resolved within 4 hours"
    renewalStatus: {
      type: String,
      enum: ["active", "expired", "up-for-renewal", "renewed", "terminated"],
      default: "active",
    },
    // Society person responsible for this contract (Section 9.4).
    inChargeUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    inChargeName: String,
    document: {
      name: String,
      mimeType: String,
      size: Number,
      contentBase64: String,
    },
  },
  { timestamps: true }
);

ContractSchema.index({ societyId: 1, contractNo: 1 }, { unique: true });

export default mongoose.models.Contract || mongoose.model("Contract", ContractSchema);
