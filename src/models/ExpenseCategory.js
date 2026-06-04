import mongoose from "mongoose";

// Dynamic expense category master (Module 11). Replaces hardcoded categories —
// admins create/edit/deactivate/reorder without code changes. Soft-delete only
// (history is preserved); never hard-deleted when transactions reference it.
const ExpenseCategorySchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    name: { type: String, required: true }, // "Lift Maintenance"
    code: { type: String, required: true }, // "LIFT_MAINT"
    // Default allocation; overridable at expense-entry time.
    allocationType: { type: String, enum: ["all", "specific", "both"], default: "all" },
    budgetHead: String, // maps to a budget line for budget-vs-actual
    gstApplicable: { type: Boolean, default: false },
    requiresApproval: { type: Boolean, default: true },
    approvalLevel: { type: Number, enum: [1, 2], default: 2 }, // 1 = Finance only, 2 = + Chairman
    parentCode: String, // optional parent for sub-categories
    spendLimitPerMonth: Number, // optional cap → alert when exceeded
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ExpenseCategorySchema.index({ societyId: 1, code: 1 }, { unique: true });

export default mongoose.models.ExpenseCategory ||
  mongoose.model("ExpenseCategory", ExpenseCategorySchema);
