import mongoose from "mongoose";
import { model, Schema, Types } from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema({
  _id: { type: Number, required: true }, // si ya lo tienes, déjalo igual

  name: { type: String, required: true, index: true },

  country_id: { type: Number, required: true, ref: "Country", index: true },
  country_code: { type: String, default: null, index: true }, // "AF"
  country_name: { type: String, default: null }, // "Afghanistan"

  iso2: { type: String, default: null, index: true }, // "BAL"
  iso3166_2: { type: String, default: null, index: true }, // "AF-BAL"
  fips_code: { type: String, default: null },

  type: { type: String, default: null }, // "province"
  level: { type: Schema.Types.Mixed, default: null }, // puede venir null
  parent_id: { type: Schema.Types.Mixed, default: null, index: true }, // null o número

  native: { type: String, default: null },

  latitude: { type: String, default: null },
  longitude: { type: String, default: null },

  timezone: { type: String, default: null }, // "Asia/Kabul"

  translations: { type: Map, of: String, default: {} },

  wikiDataId: { type: String, default: null, index: true },

  population: { type: Schema.Types.Mixed, default: null },
  active: { type: Boolean, default: true },
});

schema.index({ country_id: 1, name: 1 });
schema.index({ country_code: 1 });
schema.index({ iso3166_2: 1 }, { sparse: true });

schema.add(AdminFields);

const state = mongoose.model("state", schema);
export default state;
