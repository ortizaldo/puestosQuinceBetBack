import mongoose from "mongoose";
import { model, Schema, Types } from "mongoose";

const AdminFieldsSchema = new mongoose.Schema({
  createdBy: { type: Schema.Types.ObjectId, ref: "user" },
  createdAt: { type: Date, default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: "user" },
  updatedAt: { type: Date, default: null },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: "user", default: null },
  disabled: { type: Boolean, default: false },
  disabledAt: { type: Date, default: null },
  disabledBy: { type: Schema.Types.ObjectId, ref: "user", default: null },
});

module.exports = AdminFieldsSchema;
