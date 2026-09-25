const mongoose = require("mongoose");
const crypto = require("crypto");

const skuSchema = new mongoose.Schema(
  {
    uid: { type: String, unique: true, sparse: true, default: () => crypto.randomUUID() },
    name: { type: String, required: true, trim: true },
    hsnCode: { type: String, default: "" },
    category: { type: String, default: "" },
    subCategory: { type: String, default: "" },
    manufacturer: { type: String, default: "" },
    uom: { type: String, default: "UNIT" }, // e.g. UNIT, STRIP, BOX
    mrp: { type: Number, default: 0 },
    // Controls whether this SKU shows up in the Purchase/Sales product dropdowns.
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sku", skuSchema);
