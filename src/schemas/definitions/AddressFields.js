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
      type: Schema.Types.ObjectId,
      ref: "Country",
    },
    state: {
      type: Schema.Types.ObjectId,
      ref: "State",
    },
    municipality: {
      type: Schema.Types.ObjectId,
      ref: "Municipality",
    },
  },
};
