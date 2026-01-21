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
    type: { type: String,
      required: true,
      enum: ["stripe", "conekta", "manual"], },
    providerPaymentId: { type: String,
      required: true},
    type: { type: String,
      required: true,
      enum: ["pending", "paid", "failed", "refunded"], },
    currency: { type: String, required: true, default: "MXN" },
    items: { type: Schema.Types.Mixed },
    amount: { type: Number, required: true },
  },
  { toObject: { virtuals: true }, toJSON: { virtuals: true }, timestamps: true }
);

schema.add(AdminFields);

const WalletAccounts = mongoose.model("WalletAccounts", schema);
export default WalletAccounts;