import mongoose from "mongoose";

// Monthly electricity meter reading per unit. Consumption = current - previous.
const MeterReadingSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", index: true, required: true },
    blockCode: String, // denormalized from the unit for tower-scoped queries
    period: { type: String, required: true }, // "2026-05"
    previous: { type: Number, default: 0 },
    current: { type: Number, required: true },
    units: { type: Number, default: 0 }, // computed consumption (kWh)
    ratePerUnit: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MeterReadingSchema.index({ societyId: 1, unitId: 1, period: 1 }, { unique: true });

export default mongoose.models.MeterReading ||
  mongoose.model("MeterReading", MeterReadingSchema);
