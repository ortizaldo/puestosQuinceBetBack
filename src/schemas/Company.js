import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    logo: { type: String, required: true },
  },
  { toObject: { virtuals: true }, toJSON: { virtuals: true }, timestamps: true }
);

schema.add(AdminFields);

schema.plugin(autoIncrement, "company");

const derby = mongoose.model("company", schema);
export default derby;
