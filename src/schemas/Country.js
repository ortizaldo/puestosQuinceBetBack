import mongoose from "mongoose";
const { Schema } = mongoose;
import AdminFields from "schemas/definitions/AdminFields";

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
    name: { type: String, required: true, index: true },

    iso3: { type: String, default: null, index: true },
    iso2: { type: String, default: null, index: true },

    numeric_code: { type: String, default: null },
    phonecode: { type: String, default: null },
    capital: { type: String, default: null },

    currency: { type: String, default: null },
    currency_name: { type: String, default: null },
    currency_symbol: { type: String, default: null },

    tld: { type: String, default: null },
    native: { type: String, default: null },

    population: { type: Number, default: null },
    gdp: { type: Schema.Types.Mixed, default: null },

    // ✅ DBRef tal cual, sin pelear con $ref/$id
    region: { type: Schema.Types.Mixed, default: null },
    region_id: { type: Number, default: null, index: true },

    subregion: { type: Schema.Types.Mixed, default: null },
    subregion_id: { type: Number, default: null, index: true },

    nationality: { type: String, default: null },
    area_sq_km: { type: Number, default: null },

    postal_code_format: { type: String, default: null },
    postal_code_regex: { type: String, default: null },

    timezones: { type: [TimezoneSchema], default: [] },

    translations: { type: Map, of: String, default: {} },

    latitude: { type: String, default: null },
    longitude: { type: String, default: null },

    emoji: { type: String, default: null },
    emojiU: { type: String, default: null },

    wikiDataId: { type: String, default: null, index: true },
  },
  { collection: "countries", versionKey: false },
);

schema.add(AdminFields);

schema.index({ iso2: 1 }, { unique: true, sparse: true });
schema.index({ iso3: 1 }, { unique: true, sparse: true });

const country = mongoose.model("country", schema);
export default country;
