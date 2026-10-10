import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "eventos",
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

schema.index({ nombre: 1 }, { unique: true });

schema.plugin(autoIncrement, { model: "roosters", field: "numero" });

const roosters = mongoose.model("roosters", schema);
export default roosters;
