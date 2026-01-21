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
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },

    fightId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Fight",
      required: true,
      index: true,
    },
    side: { type: String, enum: ["red", "green"], required: true },

    stake: { type: Number, required: true }, // lo que arriesga el usuario
    oddsType: {
      type: String,
      enum: ["parejo", "80", "70", "90"],
      default: "parejo",
    },
    potentialPayout: { type: Number, required: true },

    status: {
      type: String,
      enum: ["placed", "locked", "won", "lost", "void", "refunded"],
      default: "placed",
      index: true,
    },

    placedAt: { type: Date, default: Date.now },
    lockedAt: { type: Date },
    settledAt: { type: Date },
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: true,
  },
);

schema.add(AdminFields);
schema.index({ eventId: 1, fightId: 1, status: 1 });

const Bet = mongoose.model("Bet", schema);
export default Bet;
