import mongoose from "mongoose";

// A service vendor the society engages. Full profile per Module 12 — directory,
// ratings, blacklist, TDS tracking and a named "society person in-charge".
const VendorSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    code: String, // system code e.g. VEN-001
    name: { type: String, required: true },
    trade: { type: String, default: "general" }, // legacy short tag (plumbing, lift, …)
    serviceCategory: String, // from the category master / free text
    subTags: { type: [String], default: [] }, // e.g. ["CCTV Repair", "Garden Watering"]
    contactPerson: String,
    phone: String,
    email: String,
    address: String,
    gstNumber: String,
    pan: String,
    bankAccount: String,
    ifsc: String,
    vendorType: { type: String, enum: ["individual", "proprietorship", "pvt-ltd", "llp", "other"], default: "other" },
    // Society person responsible for this vendor relationship (Section 9.4).
    inChargeUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    inChargeName: String,
    inChargePhone: String,
    // Performance & status.
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0 }, // cached average (ratingSum / ratingCount)
    blacklisted: { type: Boolean, default: false },
    blacklistReason: String,
    // Cumulative payments this financial year — drives the TDS threshold flag.
    paidThisFY: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

VendorSchema.index({ societyId: 1, name: 1 }, { unique: true });

export default mongoose.models.Vendor || mongoose.model("Vendor", VendorSchema);
