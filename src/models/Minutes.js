import mongoose from "mongoose";

// Meeting minutes (AGM / committee). Internal — gated by admin.minutes.
const MinutesSchema = new mongoose.Schema(
  {
    societyId: { type: mongoose.Schema.Types.ObjectId, ref: "Society", index: true, required: true },
    title: { type: String, required: true },
    meetingDate: Date,
    body: String,
    attendees: { type: [String], default: [] },
    postedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postedByName: String,
  },
  { timestamps: true }
);

MinutesSchema.index({ societyId: 1, meetingDate: -1 });

export default mongoose.models.Minutes || mongoose.model("Minutes", MinutesSchema);
