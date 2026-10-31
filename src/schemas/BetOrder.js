import mongoose, { Schema } from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";

const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "user", required: true, index: true },
  eventId: { type: Schema.Types.ObjectId, ref: "eventos", required: true, index: true },
  fightId: { type: Schema.Types.ObjectId, ref: "roosterfights", required: true, index: true },
  participantSide: { type: String, enum: ["RED", "GREEN"], required: true, index: true },
  marketType: { type: String, enum: ["EVEN", "GIVE_80", "TAKE_80"], required: true, index: true },
  requestedRiskAmount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  matchedRiskAmount: { type: Number, required: true, min: 0, default: 0, validate: Number.isSafeInteger },
  pendingRiskAmount: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  potentialGrossProfit: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  status: { type: String, enum: ["PENDING", "PARTIALLY_MATCHED", "MATCHED", "CANCELLED", "CLOSED_UNMATCHED", "CLOSED_PARTIALLY_MATCHED", "IN_PLAY", "WON", "LOST", "DRAW", "REFUNDED"], required: true, index: true },
  sequence: { type: Number, required: true, min: 1, index: true },
  openedAt: { type: Date, required: true },
  closedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  settledAt: { type: Date, default: null },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

schema.add(AdminFields);
schema.index({ fightId: 1, participantSide: 1, marketType: 1, status: 1, createdAt: 1, _id: 1 });
schema.index({ userId: 1, fightId: 1, createdAt: -1 });

export default mongoose.models.BetOrder || mongoose.model("BetOrder", schema);
