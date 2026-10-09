import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "events",
      required: true,
    },
    numero: {
      type: Number,
      required: true,
      min: 1,
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: true,
  },
);

schema.add(AdminFields);

schema.index({ event: 1, numero: 1 }, { unique: true });

schema.plugin(autoIncrement, "roosters");

const roosters = mongoose.model("roosters", schema);
export default roosters;
