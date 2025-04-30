import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    brookerName: { type: String, required: true },
    percent: { type: Number, required: true },
  },
  { toObject: { virtuals: true }, toJSON: { virtuals: true }, timestamps: true }
);

schema.add(AdminFields);

const team = mongoose.model("brooker", schema);
export default team;
