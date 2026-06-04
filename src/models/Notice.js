import mongoose from "mongoose";

// A notice / circular on the society notice board. Visible to all residents;
// posting is gated by admin.notice.
const NoticeSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    title: { type: String, required: true },
    body: String,
    category: { type: String, enum: ["general", "circular", "urgent", "event", "agm"], default: "general" },
    pinned: { type: Boolean, default: false },
    // AGM notice fields (mandatory under the MCS Act) — populated when category = "agm".
    meetingDate: Date,
    agenda: { type: [String], default: [] },
    postedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postedByName: String,
  },
  { timestamps: true }
);

NoticeSchema.index({ societyId: 1, createdAt: -1 });

export default mongoose.models.Notice || mongoose.model("Notice", NoticeSchema);
