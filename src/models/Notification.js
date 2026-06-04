import mongoose from "mongoose";

// In-app notification (the system's notification channel; email is mirrored
// best-effort by lib/notify.js). One row per recipient per event.
const NotificationSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true, required: true },
    title: { type: String, required: true },
    body: String,
    // entity this notification points at, for deep-linking from the UI
    kind: String, // "workrequest", "reimbursement", "bill", "maintenance", "contract", ...
    link: String, // e.g. "/approvals"
    entityId: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ societyId: 1, userId: 1, read: 1, createdAt: -1 });

export default mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);
