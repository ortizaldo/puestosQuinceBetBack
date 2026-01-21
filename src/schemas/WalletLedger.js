import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "deposit_pending",
        "deposit_approved",
        "deposit_rejected",
        "bet_hold",
        "bet_refund",
        "bet_win",
        "bet_lose",
        "stream_purchase",
        "adjustment",
      ],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "MXN" },
    referenceType: { type: String, required: true }, // "deposit" | "bet" | "entitlement" | etc
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    note: { type: String, trim: true },
    // Para hacer el ledger “idempotente” y evitar duplicados:
    idempotencyKey: { type: String, index: true, sparse: true },
    balanceAfter: { type: Number }, // opcional
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: true,
  },
);

schema.add(AdminFields);

// Si usas idempotencyKey, puedes forzar unique:
schema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

const WalletLedger = mongoose.model("WalletLedger", schema);
export default WalletLedger;
