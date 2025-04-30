import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    arma: { type: String, required: true },
    numGallos: { type: Number, required: true },
    entrance: { type: Number, required: true },
    dateEvent: { type: String, required: true },
  },
  { toObject: { virtuals: true }, toJSON: { virtuals: true }, timestamps: true }
);

schema.add(AdminFields);

const derby = mongoose.model("derby", schema);
export default derby;
