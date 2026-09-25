const mongoose = require("mongoose");
const crypto = require("crypto");

const partySchema = new mongoose.Schema(
  {
    uid: { type: String, unique: true, sparse: true, default: () => crypto.randomUUID() },
    partyType: { type: String, enum: ["vendor", "customer"], required: true },
    name: { type: String, required: true, trim: true },
    gstNumber: { type: String, trim: true, uppercase: true, default: "" },
    contactPerson: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    addressLine1: { type: String, trim: true, default: "" },
    addressLine2: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
    enabled: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

partySchema.index(
  { partyType: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.model("Party", partySchema);
