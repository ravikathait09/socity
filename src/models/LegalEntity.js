import mongoose from "mongoose";

// A legal/financial entity within a society — either the society itself or a
// block group (e.g. "A+B") that can hold funds and take loans independently.
const LegalEntitySchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    name: { type: String, required: true }, // "Greenwood A+B Block Assoc."
    kind: { type: String, enum: ["society", "block-group"], default: "block-group" },
    blockCodes: { type: [String], default: [] }, // ["A", "B"]
    pan: String,
    bankAccount: String,
    description: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

LegalEntitySchema.index({ societyId: 1, name: 1 }, { unique: true });

export default mongoose.models.LegalEntity ||
  mongoose.model("LegalEntity", LegalEntitySchema);
