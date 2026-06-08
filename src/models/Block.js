import mongoose from "mongoose";

// A block (tower/wing) within a society. Can be standalone or part of a group.
const BlockSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    code: { type: String, required: true }, // "A", "B", ...
    name: String,
    totalFloors: Number,
    // Tower-specific amenities (lift, pump, CCTV, …) — used for tower-specific costs.
    amenities: { type: [String], default: [] },
    mode: { type: String, enum: ["standalone", "grouped"], default: "standalone" },
    groupName: String, // e.g. "A+B"
    unitCount: { type: Number, default: 0 },
    // Per-tower MOFA charge-head overrides. When mofaOverride is true, billing
    // uses these instead of the society defaults for this tower's flats. Each
    // field falls back to the society setting if left null.
    mofaOverride: { type: Boolean, default: false },
    settings: {
      maintenanceBasis: { type: String, enum: ["flat", "sqft", null], default: null },
      serviceChargePerFlat: { type: Number, default: null },
      serviceChargePerSqft: { type: Number, default: null },
      sinkingFundRatePerSqft: { type: Number, default: null },
      repairFundRatePerSqft: { type: Number, default: null },
      waterChargePerInlet: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

BlockSchema.index({ societyId: 1, code: 1 }, { unique: true });

export default mongoose.models.Block || mongoose.model("Block", BlockSchema);
