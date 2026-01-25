import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    records: { type: Number, required: true },
    metadata: {
      fields: { type: [String], required: true },
    },
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: true,
  },
);

schema.add(AdminFields);

schema.plugin(autoIncrement, "catalog");

const catalog = mongoose.model("catalog", schema);
export default catalog;
