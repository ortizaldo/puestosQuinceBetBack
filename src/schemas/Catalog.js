import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    records: { type: Number, required: true },
    metadata: {
      select: { type: [String], required: true },
      texts: {
        title: { type: String, required: true },
        headerDetails: { type: String, required: true },
        emptyMessage: { type: String, required: true },
      },
      form: [
        {
          name: { type: String, required: true },
        },
      ],
      endpoint: { type: String, required: true },
      populate: [
        {
          path: { type: String, required: true },
          select: { type: String, required: true },
        },
      ],
      columns: [
        {
          field: { type: String, required: true },
          header: { type: String, required: true },
        },
      ],
    },
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: true,
  },
);

schema.add(AdminFields);

const catalog = mongoose.model("catalog", schema);
export default catalog;
