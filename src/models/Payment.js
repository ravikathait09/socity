import mongoose from "mongoose";

// A payment receipt against a bill. (Phase 2 surface; model ready now.)
const PaymentSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill", index: true, required: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", index: true },
    blockCode: String, // denormalized from the bill for tower-scoped queries
    period: String,
    amount: { type: Number, required: true },
    method: { type: String, enum: ["cash", "upi", "bank", "cheque", "online"], default: "upi" },
    reference: String,
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paidAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export default mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
