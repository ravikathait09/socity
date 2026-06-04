import mongoose from "mongoose";

// A loan taken by a legal entity (e.g. to fund a common-area project).
// EMI + outstanding are computed in lib/finance.js, not stored, so they always
// reflect repayments recorded against the loan.
const LoanSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    legalEntityId: { type: mongoose.Schema.Types.ObjectId, ref: "LegalEntity", index: true, required: true },
    purpose: { type: String, required: true }, // "Lift replacement"
    lender: String, // "HDFC Bank"
    principal: { type: Number, required: true },
    annualRate: { type: Number, default: 0 }, // % per annum
    tenureMonths: { type: Number, required: true },
    startDate: { type: Date, default: () => new Date() },
    status: { type: String, enum: ["active", "closed"], default: "active" },
    repaid: { type: Number, default: 0 }, // total principal+interest repaid so far
  },
  { timestamps: true }
);

export default mongoose.models.Loan || mongoose.model("Loan", LoanSchema);
