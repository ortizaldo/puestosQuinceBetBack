import mongoose, { Schema } from "mongoose";

const schema = new Schema(
  {
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "user", required: true, index: true },
    type: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    amountCents: { type: Number, required: true, min: 1, validate: Number.isSafeInteger, immutable: true },
    balanceAfterCents: { type: Number, required: true, min: 0, validate: Number.isSafeInteger, immutable: true },
    source: { type: String, required: true, trim: true, immutable: true },
    reference: { type: String, trim: true, default: "", immutable: true },
    description: { type: String, required: true, trim: true, immutable: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "user", default: null, immutable: true },
    requestId: { type: String, trim: true, immutable: true },
    occurredAt: { type: Date, required: true, default: Date.now, immutable: true },
  },
  { timestamps: true },
);

schema.index({ walletId:  1, occurredAt: -1 });
schema.index({ userId: 1, occurredAt: -1 });
schema.index({ requestId: 1 }, { unique: true, sparse: true });
export default mongoose.models.WalletTransaction || mongoose.model("WalletTransaction", schema);
