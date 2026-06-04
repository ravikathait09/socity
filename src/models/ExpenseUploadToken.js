import mongoose from "mongoose";

// A single-use, expiring invitation for a third-party vendor to upload a bill
// WITHOUT a login. The token carries the societyId so the public submit endpoint
// can scope the created (pending) expense to the right tenant.
const ExpenseUploadTokenSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    token: { type: String, required: true, unique: true, index: true },
    vendorName: String,
    category: String,
    period: String, // suggested billing period, e.g. "2026-05"
    note: String,
    expiresAt: { type: Date, required: true },
    usedAt: Date,
    createdExpenseId: { type: mongoose.Schema.Types.ObjectId, ref: "Expense" },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: String,
  },
  { timestamps: true }
);

export default mongoose.models.ExpenseUploadToken ||
  mongoose.model("ExpenseUploadToken", ExpenseUploadTokenSchema);
