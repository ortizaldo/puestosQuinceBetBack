import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
require("mongoose-double")(mongoose);
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const SchemaTypes = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    derby: {
      type: Schema.Types.ObjectId,
      ref: "derby",
      required: true,
    },
    roosterConf: {
      tolerance: { type: Number, required: true },
      minWeight: { type: Number, required: true },
      maxWeight: { type: Number, required: true },
    },
  },
  { toObject: { virtuals: true }, toJSON: { virtuals: true }, timestamps: true }
);

schema.add(AdminFields);

const derbyConf = mongoose.model("derbyconf", schema);
export default derbyConf;
