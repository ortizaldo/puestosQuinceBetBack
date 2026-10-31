import mongoose, { Schema } from "mongoose";

const schema = new Schema({
  _id: { type: String, default: "global" },
  minimumBetCents: { type: Number, required: true, default: 100, min: 100, max: 1000000000, validate: Number.isSafeInteger },
  commissionBps: { type: Number, required: true, default: 0, min: 0, max: 10000, validate: Number.isSafeInteger },
  updatedBy: { type: Schema.Types.ObjectId, ref: "user", default: null },
}, { timestamps: true });

export default mongoose.models.BettingConfig || mongoose.model("BettingConfig", schema);
