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
    gstRate: { type: Number, min: 0, max: 100, default: 0 },
    gstAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const saleInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
    customerName: { type: String, required: true, trim: true },
    saleDate: { type: Date, required: true },
    items: { type: [saleItemSchema], validate: (v) => v.length > 0 },
    totalQty: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    gstRate: { type: Number, min: 0, max: 100, default: 0 },
    gstAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "confirmed"], default: "draft" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Indexes to optimize query performance for reports and history lookups
// 1. Index on saleDate speeds up date-range filtering and sorting in sales reports
saleInvoiceSchema.index({ saleDate: -1 });
// 2. Index on items.sku speeds up item-level history queries and slow/non-moving aggregation pipelines
saleInvoiceSchema.index({ "items.sku": 1 });

module.exports = mongoose.model("SaleInvoice", saleInvoiceSchema);
