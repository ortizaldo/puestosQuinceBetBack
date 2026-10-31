import mongoose, { Schema } from "mongoose";

const schema = new Schema(
  {
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet", required: true, index: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, ref: "user", required: true, index: true, immutable: true },
    type: { type: String, enum: ["CREDIT", "DEBIT", "BET_RESERVE", "BET_MATCHED", "BET_RELEASE", "BET_CANCEL_RELEASE", "BET_WIN", "BET_LOSS", "BET_COMMISSION", "BET_DRAW_REFUND", "BET_FIGHT_REFUND"], required: true, immutable: true },
    amountCents: { type: Number, required: true, min: 1, validate: Number.isSafeInteger, immutable: true },
    balanceAfterCents: { type: Number, required: true, min: 0, validate: Number.isSafeInteger, immutable: true },
    source: { type: String, required: true, trim: true, immutable: true },
    reference: { type: String, trim: true, default: "", immutable: true },
    description: { type: String, required: true, trim: true, immutable: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "user", default: null, immutable: true },
    requestId: { type: String, trim: true, immutable: true },
    idempotencyKey: { type: String, trim: true, immutable: true },
    referenceType: { type: String, trim: true, immutable: true },
    referenceId: { type: Schema.Types.ObjectId, immutable: true },
    eventId: { type: Schema.Types.ObjectId, immutable: true },
    fightId: { type: Schema.Types.ObjectId, immutable: true },
    balanceBeforeCents: { type: Number, min: 0, validate: Number.isSafeInteger, immutable: true },
    metadata: { type: Schema.Types.Mixed, immutable: true },
    occurredAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { timestamps: true },
);

schema.index({ walletId:  1, occurredAt: -1 });
schema.index({ userId: 1, occurredAt: -1 });
schema.index({ requestId: 1 }, { unique: true, sparse: true });
schema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
export default mongoose.models.WalletTransaction || mongoose.model("WalletTransaction", schema);
