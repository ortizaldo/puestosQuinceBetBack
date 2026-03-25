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
      required: true,
      ref: "Country",
    },
    state: { type: Number, required: true, ref: "state" },
    municipality: {
      type: Number,
      required: true,
      ref: "cities",
    },
  },
};
