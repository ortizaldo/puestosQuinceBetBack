import mongoose from "mongoose";
import { model, Schema, Types } from "mongoose";
import * as AdminFields from "./definitions/AdminFields.js";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema({
  _id: { type: Number, required: true },
  name: { type: String, required: true, trim: true },
  country_id: { type: Number, ref: "country", required: true },
  active: { type: Boolean, default: true },
});

schema.index({ country_id: 1, name: 1 });

schema.virtual("country_data", {
  ref: "countries",
  localField: "country_id",
  foreignField: "_id",
  justOne: true,
});

// Para que virtuals salgan en JSON
schema.set("toJSON", { virtuals: true });
schema.set("toObject", { virtuals: true });

schema.add(AdminFields);

const State = mongoose.models.State || mongoose.model("State", schema);
export default State;
