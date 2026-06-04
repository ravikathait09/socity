import mongoose from "mongoose";

// Reimbursement Request Management (Module 10). A staff/committee member who
// spent personal money for society work claims it back through a two-level
// workflow (Finance → Chairman) ending in a payout.
//
// Status lifecycle (per spec 7.4):
//   submitted -> under_finance_review -> finance_approved
//             -> chairman_approved -> payment_processed -> closed
//   rejected  (at finance or chairman, reason mandatory)
//   cancelled (requester withdrew before approval)
const ReimbursementSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    code: { type: String, required: true }, // "RMB-0001"
    // requester
    requestedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    requestedByName: String,
    requesterRole: String, // snapshot of primary role (drives the limit check)
    // expense details
    dateOfExpense: { type: Date, required: true },
    category: String,
    categoryCode: String,
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    vendorPayee: String,
    blockCode: String, // tower / common area this relates to
    paymentModeUsed: { type: String, enum: ["cash", "upi", "bank"], default: "cash" },
    requesterBankUpi: String, // where to credit the reimbursement
    notes: String,
    // mandatory bill / receipt (inline base64)
    receipt: {
      name: String,
      mimeType: String,
      size: Number,
      contentBase64: String,
    },
    // workflow
    status: {
      type: String,
      enum: [
        "submitted",
        "under_finance_review",
        "finance_approved",
        "chairman_approved",
        "payment_processed",
        "closed",
        "rejected",
        "cancelled",
      ],
      default: "submitted",
    },
    overLimit: { type: Boolean, default: false }, // exceeded role limit → auto-escalates
    financeRemark: String,
    rejectedReason: String,
    rejectedStage: String, // "finance" | "chairman"
    // payout
    paymentRef: String,
    paymentMode: String,
    paidAt: Date,
    paidById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    closedAt: Date,
  },
  { timestamps: true }
);

ReimbursementSchema.index({ societyId: 1, createdAt: -1 });

export default mongoose.models.Reimbursement ||
  mongoose.model("Reimbursement", ReimbursementSchema);
