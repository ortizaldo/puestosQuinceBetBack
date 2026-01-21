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
      enum: ["event_stream", "subscription"],
      required: true,
      index: true,
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      index: true,
    }, // requerido si es event_stream

    status: {
      type: String,
      enum: ["active", "expired", "revoked"],
      default: "active",
      index: true,
    },
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },

    source: {
      type: String,
      enum: ["wallet", "admin_grant"],
      default: "wallet",
    },
    sourceRefId: { type: mongoose.Schema.Types.ObjectId }, // ledgerId o algo similar
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: true,
  },
);

schema.add(AdminFields);

const Entitlement = mongoose.model("Entitlement", schema);
export default Entitlement;
