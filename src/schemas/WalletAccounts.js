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
    currency: { type: String, required: true, default: "MXN" },
    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
      index: true,
    },
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: true,
  },
);

schema.add(AdminFields);

const WalletAccounts = mongoose.model("WalletAccounts", schema);
export default WalletAccounts;
