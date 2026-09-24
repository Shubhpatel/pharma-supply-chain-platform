const mongoose = require("mongoose");

const skuSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    hsnCode: { type: String, default: "" },
    category: { type: String, default: "" },
    subCategory: { type: String, default: "" },
    manufacturer: { type: String, default: "" },
    uom: { type: String, default: "UNIT" }, // e.g. UNIT, STRIP, BOX
    gst: { type: Number, default: 0 }, // GST %
    mrp: { type: Number, default: 0 },
    // Controls whether this SKU shows up in the Purchase/Sales product dropdowns.
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sku", skuSchema);
