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
  },
  { timestamps: true }
);

BlockSchema.index({ societyId: 1, code: 1 }, { unique: true });

export default mongoose.models.Block || mongoose.model("Block", BlockSchema);
