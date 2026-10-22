import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    event: {
      type: Schema.Types.ObjectId,
      ref: "eventos",
      required: true,
    },
    cotejo: { type: Number, required: true, min: 1 },
    ronda: { type: Number, required: true, min: 1 },
    verde: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "roosters",
        required: true,
      },
      peso: { type: Number, default: 0, min: 0 },
      anillo: { type: Number, default: 0, min: 0 },
    },
    rojo: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "roosters",
        required: true,
      },
      peso: { type: Number, default: 0, min: 0 },
      anillo: { type: Number, default: 0, min: 0 },
    },
    diferenciaGramos: { type: Number, required: true, min: 0 },
    estado: {
      type: String,
      enum: ["PROGRAMADA", "EN_CURSO", "FINALIZADA"],
      default: "PROGRAMADA",
    },
    resultado: {
      type: String,
      enum: ["VERDE", "ROJO", "TABLAS", null],
      default: null,
    },
    puntuacion: {
      type: String,
      enum: ["0", "1", "3"],
      default: 0,
    },
    duracionSegundos: { type: Number, min: 0, default: null },
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: true,
  },
);

schema.add(AdminFields);

schema.index({ event: 1, cotejo: 1 }, { unique: true });

schema.plugin(autoIncrement, "RoosterFights");

const User = mongoose.model("roosterfights", schema);
export default User;
