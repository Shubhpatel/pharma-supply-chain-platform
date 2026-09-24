const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema(
  {
    sku: { type: mongoose.Schema.Types.ObjectId, ref: "Sku", required: true, unique: true },
    qty: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Stock", stockSchema);
