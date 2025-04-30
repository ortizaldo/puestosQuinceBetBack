import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    derby: {
      type: Schema.Types.ObjectId,
      ref: "derby",
      required: true,
    },
    teams: {},
  },
  { toObject: { virtuals: true }, toJSON: { virtuals: true }, timestamps: true }
);

schema.add(AdminFields);

schema.plugin(autoIncrement, "roosters");

const roosters = mongoose.model("roosters", schema);
export default roosters;
