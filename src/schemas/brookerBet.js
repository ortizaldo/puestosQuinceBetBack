import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    derby: {
      type: Schema.Types.ObjectId,
      ref: "derbies",
      required: true,
    },
    brooker: {
      type: Schema.Types.ObjectId,
      ref: "brookers",
      required: true,
    },
    folio: { type: Number, required: true },
    amount: { type: Number, required: true },
    nulo: { type: Boolean, required: false, default: false },
  },
  { toObject: { virtuals: true }, toJSON: { virtuals: true }, timestamps: true }
);

schema.add(AdminFields);

const team = mongoose.model("brookerBet", schema);
export default team;
