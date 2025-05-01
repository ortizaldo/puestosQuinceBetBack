import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    arma: { type: String, required: true },
    numGallos: { type: Number, required: true },
    pesos: { type: String, required: true },
    puntos: { type: String, required: true },
    fechaEvento: { type: String, required: true },
    horarioBascula: { type: String, required: true },
  },
  { toObject: { virtuals: true }, toJSON: { virtuals: true }, timestamps: true }
);

schema.add(AdminFields);

const derby = mongoose.model("eventos", schema);
export default derby;
