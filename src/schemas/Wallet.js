import mongoose, { Schema } from "mongoose";

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "user", required: true, unique: true, index: true },
    // Monetary amounts are stored as integer centavos to avoid floating point drift.
    balanceCents: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
    currency: { type: String, required: true, default: "MXN", immutable: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

schema.index({ userId: 1 }, { unique: true });
export default mongoose.models.Wallet || mongoose.model("Wallet", schema);
