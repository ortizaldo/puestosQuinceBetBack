import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";

const schema = new mongoose.Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "user", default: null },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
  },
  { toObject: { virtuals: true }, toJSON: { virtuals: true }, timestamps: true }
);

schema.add(AdminFields);
const User = mongoose.model("accesstoken", schema);
export default User;
