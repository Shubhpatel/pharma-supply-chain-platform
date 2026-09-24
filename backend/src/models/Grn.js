const mongoose = require("mongoose");

const grnItemSchema = new mongoose.Schema(
  {
    sku: { type: mongoose.Schema.Types.ObjectId, ref: "Sku", required: true },
    skuName: { type: String, required: true },
    qtyOrdered: { type: Number, required: true },
    qtyReceived: { type: Number, required: true, min: 0 },
    batch: { type: String, required: true, trim: true },
    expiryDate: { type: Date, required: true },
    mrp: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true }, // qtyReceived * rate
    gstRate: { type: Number, min: 0, max: 100, default: 0 },
    gstAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const grnSchema = new mongoose.Schema(
  {
    grnNumber: { type: String, required: true, unique: true },
    purchaseOrder: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseOrder", required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
    poNumber: { type: String, required: true }, // snapshot for easy display
    supplierName: { type: String, required: true },
    grnDate: { type: Date, required: true },
    purchaseInvoiceNumber: { type: String, required: true, trim: true },
    purchaseInvoiceDate: { type: Date, required: true },
    items: { type: [grnItemSchema], validate: (v) => v.length > 0 },
    totalQty: { type: Number, required: true },
    totalValue: { type: Number, required: true },
    gstRate: { type: Number, min: 0, max: 100, default: 0 },
    gstAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    status: { type: String, enum: ["confirmed"], default: "confirmed" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Grn", grnSchema);
