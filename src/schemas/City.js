import mongoose from "mongoose";
import { model, Schema, Types } from "mongoose";
import * as AdminFields from "./definitions/AdminFields.js";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema({
  _id: { type: Number, required: true },
  name: { type: String, required: true, trim: true },
  state_id: { type: Number, ref: "state", required: true },
  country_id: { type: Number, ref: "country", required: true },
  active: { type: Boolean, default: true },
});

schema.index({ country_id: 1, state_id: 1, name: 1 }, { unique: false });

schema.add(AdminFields);

const City = mongoose.models.cities || mongoose.model("cities", schema);
export default City;