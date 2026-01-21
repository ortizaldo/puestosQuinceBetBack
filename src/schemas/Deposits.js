import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const DepositSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "MXN" },

    method: {
      type: String,
      enum: ["manual_deposit"],
      default: "manual_deposit",
    },
    proofUrl: { type: String }, // link/archivo
    trackingKey: { type: String, trim: true, index: true }, // tu “clave de rastreo” si la detectas

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true },
  },
  { timestamps: true },
);

DepositSchema.add(AdminFields);

const Deposit = mongoose.model("Deposit", DepositSchema);
export default Deposit;
