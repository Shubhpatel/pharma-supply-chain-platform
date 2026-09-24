const mongoose = require("mongoose");

const saleItemSchema = new mongoose.Schema(
  {
    sku: { type: mongoose.Schema.Types.ObjectId, ref: "Sku", required: true },
    skuName: { type: String, required: true },
    batch: { type: String, required: true, trim: true },
    expiryDate: { type: Date, required: true },
    mrp: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true }, // qty * rate
  },
  { _id: false }
);

const saleInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    customerName: { type: String, required: true, trim: true },
    saleDate: { type: Date, required: true },
    items: { type: [saleItemSchema], validate: (v) => v.length > 0 },
    totalQty: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SaleInvoice", saleInvoiceSchema);
