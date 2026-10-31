import mongoose, { Schema } from "mongoose";

const schema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: "eventos", required: true, index: true },
  fightId: { type: Schema.Types.ObjectId, ref: "roosterfights", required: true, index: true },
  marketType: { type: String, enum: ["EVEN", "LINE_80"], required: true },
  redOrderId: { type: Schema.Types.ObjectId, ref: "BetOrder", required: true, index: true },
  greenOrderId: { type: Schema.Types.ObjectId, ref: "BetOrder", required: true, index: true },
  redUserId: { type: Schema.Types.ObjectId, ref: "user", required: true, index: true },
  greenUserId: { type: Schema.Types.ObjectId, ref: "user", required: true, index: true },
  redRiskAmount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  greenRiskAmount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  redPotentialProfit: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  greenPotentialProfit: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  status: { type: String, enum: ["OPEN", "IN_PLAY", "WON_RED", "WON_GREEN", "DRAW", "REFUNDED"], default: "OPEN", required: true, index: true },
  settledAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ fightId: 1, status: 1, createdAt: 1 });
export default mongoose.models.BetMatch || mongoose.model("BetMatch", schema);
