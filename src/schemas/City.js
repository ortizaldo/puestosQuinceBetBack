import mongoose from "mongoose";
import { model, Schema, Types } from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema({
  _id: { type: Number, required: true }, // tu id numérico (52)

  name: { type: String, required: true, trim: true },
  state_id: { type: Number, required: true, ref: "states", index: true },
  state_code: { type: String, trim: true, index: true },
  state_name: { type: String, trim: true },
  country_id: { type: Number, required: true, ref: "countries", index: true },
  country_code: { type: String, trim: true, index: true },
  country_name: { type: String, trim: true },

  latitude: { type: Number }, // en tu JSON viene string, aquí lo guardas como Number
  longitude: { type: Number }, // idem

  native: { type: String, trim: true },

  type: { type: String, default: "city", index: true },
  level: { type: String, default: null },
  parent_id: { type: Number, default: null, index: true },

  population: { type: Number, default: 0 },
  timezone: { type: String, trim: true, index: true },

  translations: {
    // como tu objeto tiene llaves variables (br, ko, pt-BR, etc.)
    type: Map,
    of: String,
    default: {},
  },

  wikiDataId: { type: String, trim: true, index: true },

  // GeoJSON
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
      required: true,
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: "location.coordinates debe ser [lng, lat]",
      },
    },
  },
  active: { type: Boolean, default: true },
});

schema.index({ country_id: 1, state_id: 1, name: 1 }, { unique: false });

schema.add(AdminFields);

const municipality = mongoose.model("cities", schema);
export default municipality;
