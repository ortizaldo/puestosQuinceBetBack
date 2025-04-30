import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    brooker: {
      type: Schema.Types.ObjectId,
      ref: "brooker",
      required: true,
    },
    initialFolio: { type: Number, required: true },
    endFolio: { type: Number, required: true },
  },
  { toObject: { virtuals: true }, toJSON: { virtuals: true }, timestamps: true }
);

schema.add(AdminFields);

const team = mongoose.model("betStubs", schema);
export default team;
