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
    teamName: { type: String, required: true },
    rings: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { toObject: { virtuals: true }, toJSON: { virtuals: true }, timestamps: true }
);

schema.add(AdminFields);

const team = mongoose.model("team", schema);
export default team;
