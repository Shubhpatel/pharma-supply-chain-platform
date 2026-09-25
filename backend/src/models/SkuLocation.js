const mongoose = require("mongoose");

const skuLocationSchema = new mongoose.Schema(
  {
    sku: { type: mongoose.Schema.Types.ObjectId, ref: "Sku", required: true, unique: true },
    location: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SkuLocation", skuLocationSchema);
