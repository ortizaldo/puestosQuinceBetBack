import mongoose from "mongoose";
import { model, Schema, Types } from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema({
  country: {
    type: Schema.Types.ObjectId,
    ref: "countries",
    default: null,
    required: true,
  },
  description: { type: String, required: true },
  abbr: { type: String, required: false },
  active: { type: Boolean, default: true },
});

schema.add(AdminFields);

const state = mongoose.model("state", schema);
export default state;
