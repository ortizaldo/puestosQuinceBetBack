import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },

    tipoEvento: {
      type: String,
      required: true,
    },

    arma: {
      type: String,
      enum: ["1/4", "1", "1/2"],
      required: true,
    },

    numGallos: {
      type: Number,
      required: true,
    },

    creditos: {
      type: Number,
      required: true,
    },

    peleaXDentro: {
      type: Number,
      required: false,
    },

    fechaEvento: {
      type: Date,
      required: true,
    },

    horarioBasculaInicio: {
      type: String,
      default: null,
    },

    horarioBasculaFin: {
      type: String,
      default: null,
    },

    pesoMinimo: { type: Number, required: true },
    pesoMaximo: { type: Number, required: true },

    flyer: {
      url: {
        type: String,
        default: null,
      },

      publicId: {
        type: String,
        default: null,
      },

      nombreArchivo: {
        type: String,
        default: null,
      },
    },

    status: {
      type: String,
      enum: [
        "DRAFT",
        "PUBLISHED",
        "OPEN",
        "IN_PROGRESS",
        "FINISHED",
        "CANCELLED",
      ],
      default: "DRAFT",
    },
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: true,
  },
);

schema.add(AdminFields);

const derby = mongoose.model("eventos", schema);
export default derby;
