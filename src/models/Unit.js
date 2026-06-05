import mongoose from "mongoose";

// A flat/unit. Holds owner + tenant info and its electricity meter id.
const UnitSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    blockId: { type: mongoose.Schema.Types.ObjectId, ref: "Block", index: true },
    blockCode: String,
    number: { type: String, required: true }, // "A-101"
    floor: Number,
    areaSqft: Number, // carpet area
    bhk: String, // "1BHK", "2BHK", "3BHK", ...
    waterInlets: { type: Number, default: 1 }, // drives MOFA water charge
    // Optional per-flat monthly maintenance override (e.g. shops or custom deals).
    // When set (> 0) it replaces the society-wide maintenance computation.
    monthlyMaintenance: Number,
    ownerName: String,
    ownerPhone: String,
    ownerEmail: String,
    ownerPan: String,
    ownerAadhaar: String, // optional
    tenantName: String,
    tenantPhone: String,
    tenantEmail: String,
    leaseStart: Date,
    leaseEnd: Date,
    occupancy: { type: String, enum: ["owner", "tenant", "vacant"], default: "owner" },
    meterNo: String,
  },
  { timestamps: true }
);

UnitSchema.index({ societyId: 1, number: 1 }, { unique: true });

export default mongoose.models.Unit || mongoose.model("Unit", UnitSchema);
