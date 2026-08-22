import { model, Schema, Types } from "mongoose";
import mongoose from "mongoose";
import AdminFields from "schemas/definitions/AdminFields";

const schema = new mongoose.Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "user", default: null },
    tokenHash: { type: String, required: true },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    createdAt: { type: Date, default: null },
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
    timestamps: true,
  },
);

schema.add(AdminFields);
const User = mongoose.model("TokenEmail", schema);
export default User;
