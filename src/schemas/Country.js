import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";

const schema = new mongoose.Schema({
  description: { type: String, required: true },
  active: { type: Boolean, default: true },
});

schema.add(AdminFields);

const country = mongoose.model("country", schema);
export default country;
