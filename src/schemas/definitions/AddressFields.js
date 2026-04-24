import { Schema } from "mongoose";

export default {
  address: {
    addressStreet: {
      type: String,
    },
    postalCode: {
      type: String,
    },
    country: {
      type: Number,
      required: false,
      ref: "Country",
    },
    state: { type: Number, required: false, ref: "state" },
    municipality: {
      type: Number,
      required: false,
      ref: "cities",
    },
  },
};
