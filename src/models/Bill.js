import mongoose from "mongoose";

// A monthly bill for a unit: power charge + pro-rated common expense + penalty.
const BillSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", index: true, required: true },
    unitNumber: String,
    blockCode: String,
    period: { type: String, required: true }, // "2026-05"
    powerUnits: { type: Number, default: 0 },
    powerCharge: { type: Number, default: 0 },
    commonCharge: { type: Number, default: 0 }, // pro-rated approved expenses
    // MOFA bye-law charge heads.
    serviceCharge: { type: Number, default: 0 },
    sinkingFund: { type: Number, default: 0 },
    repairFund: { type: Number, default: 0 },
    waterCharge: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    interest: { type: Number, default: 0 }, // interest on arrears carried forward
    penalty: { type: Number, default: 0 }, // flat/percentage late fee
    total: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "paid", "partial", "overdue"], default: "pending" },
    dueDate: Date,
    lineItems: [{ label: String, amount: Number }],
  },
  { timestamps: true }
);

BillSchema.index({ societyId: 1, unitId: 1, period: 1 }, { unique: true });

export default mongoose.models.Bill || mongoose.model("Bill", BillSchema);
