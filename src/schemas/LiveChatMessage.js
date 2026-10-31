import mongoose from "mongoose";

const schema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "eventos", required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  username: { type: String, required: true, trim: true, maxlength: 60 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
}, { timestamps: true });

schema.index({ eventId: 1, createdAt: -1 });

export default mongoose.model("livechatmessages", schema);
