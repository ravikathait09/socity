import mongoose from "mongoose";

// Document vault entry. Stores either an external link (url) or a small inline
// file as base64 (capped in the route). Gated by admin.documents.
const DocumentSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    name: { type: String, required: true },
    category: { type: String, default: "general" }, // bylaws, agm, finance, legal, ...
    url: String, // external link (e.g. Google Drive / S3)
    contentBase64: String, // small inline file (data only, no data: prefix)
    mimeType: String,
    size: Number, // bytes
    uploadedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedByName: String,
  },
  { timestamps: true }
);

DocumentSchema.index({ societyId: 1, createdAt: -1 });

export default mongoose.models.Document || mongoose.model("Document", DocumentSchema);
