import mongoose, { Schema } from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";
import AddressFields from "schemas/definitions/AddressFields";
import { autoIncrement } from "mongoose-plugin-autoinc";

const schema = new mongoose.Schema(
  {
    // company: { type: Schema.Types.ObjectId, ref: "company", default: null },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    hashedPassword: { type: String, required: false },
    typeUser: { type: String, required: false, default: "admin" },
    phoneNumber: { type: String, required: false },
  },
  { toObject: { virtuals: true }, toJSON: { virtuals: true }, timestamps: true }
);

schema.add(AdminFields);
schema.add(AddressFields);

schema.plugin(autoIncrement, { model: "user", field: "userId", startAt: 1 });
const User = mongoose.model("user", schema);
export default User;
