const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema(
  {
    sku: { type: mongoose.Schema.Types.ObjectId, ref: "Sku", required: true },
    batch: { type: String, required: true, trim: true },
    expiryDate: { type: Date, required: true },
    mrp: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

stockSchema.index({ sku: 1, batch: 1, expiryDate: 1, mrp: 1, rate: 1 }, { unique: true });

module.exports = mongoose.model("Stock", stockSchema);
