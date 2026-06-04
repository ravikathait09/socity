import mongoose from "mongoose";

// One row per tenant. Everything else hangs off societyId.
const SocietySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    address: String,
    city: String,
    // Statutory / registration profile (MCS Act).
    registrationNo: String, // MCS Act registration number
    ward: String, // Pune ward / zone
    fyStartMonth: { type: Number, default: 4, min: 1, max: 12 }, // April for most MH societies
    // How blocks are grouped for billing/expense splitting.
    // "standalone" -> each block billed separately; "grouped" -> use blockGroups.
    blockMode: { type: String, enum: ["standalone", "grouped"], default: "standalone" },
    blockGroups: [{ name: String, blockCodes: [String] }],
    currency: { type: String, default: "INR" },
    active: { type: Boolean, default: true },
    // Per-society finance configuration (replaces hardcoded constants).
    settings: {
      penaltyPct: { type: Number, default: 2 }, // late fee % of outstanding
      penaltyMin: { type: Number, default: 100 }, // minimum late fee
      graceDays: { type: Number, default: 15 }, // days after month-end before overdue
      defaultElectricityRate: { type: Number, default: 9 }, // ₹ per unit fallback
      defaultSplitRule: { type: String, enum: ["equal", "area", "block"], default: "equal" },
      // MOFA bye-law charge heads (per the model bye-laws No. 65–71).
      serviceChargePerFlat: { type: Number, default: 0 }, // flat service/maintenance charge
      sinkingFundRatePerSqft: { type: Number, default: 0 }, // ₹/sq.ft of carpet area
      repairFundRatePerSqft: { type: Number, default: 0 }, // ₹/sq.ft of carpet area
      waterChargePerInlet: { type: Number, default: 0 }, // ₹ per water inlet
      // Interest on arrears — typically 21% p.a. under Maharashtra bye-laws.
      arrearsInterestPct: { type: Number, default: 21 },
      // GST (18% applies if a member's charges > ₹7,500 AND annual collection > ₹20L).
      gstApplicable: { type: Boolean, default: false },
      gstRate: { type: Number, default: 18 },
      gstThresholdPerFlat: { type: Number, default: 7500 },
      // Approval workflow depth (2 = Finance → Chairman; 3 adds a Secretary pre-check).
      approvalLevels: { type: Number, default: 2, min: 1, max: 3 },
      // Reimbursement single-claim limits per role name (₹). Above this auto-escalates.
      reimbursementLimits: { type: Map, of: Number, default: {} },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Society || mongoose.model("Society", SocietySchema);
