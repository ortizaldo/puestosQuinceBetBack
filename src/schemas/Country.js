import mongoose from "mongoose";
const { Schema } = mongoose;
import * as AdminFields from "./definitions/AdminFields.js";

const TimezoneSchema = new Schema(
  {
    zoneName: String,
    gmtOffset: Number,
    gmtOffsetName: String,
    abbreviation: String,
    tzName: String,
  },
  { _id: false },
);

const schema = new Schema(
  {
    _id: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    iso2: { type: String, trim: true, uppercase: true }
  },
  {
    collection: "countries",
    timestamps: true,
    versionKey: false,
  },
);

schema.add(AdminFields);

const Country = mongoose.models.Country || mongoose.model("Country", schema);
export default Country;
