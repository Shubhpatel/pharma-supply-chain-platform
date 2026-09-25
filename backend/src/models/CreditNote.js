const mongoose = require("mongoose");

const creditNoteItemSchema = new mongoose.Schema(
  {
    sku: { type: mongoose.Schema.Types.ObjectId, ref: "Sku", required: true },
    skuName: { type: String, required: true },
    batch: { type: String, required: true, trim: true },
    expiryDate: { type: Date, required: true },
    mrp: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true },
    gstRate: { type: Number, min: 0, max: 100, default: 0 },
    gstAmount: { type: Number, default: 0 },
  },
  { _id: false }
);

const creditNoteSchema = new mongoose.Schema(
  {
    creditNoteNumber: { type: String, required: true, unique: true },
    saleInvoice: { type: mongoose.Schema.Types.ObjectId, ref: "SaleInvoice", required: true },
    invoiceNumber: { type: String, required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
    customerName: { type: String, required: true },
    returnDate: { type: Date, required: true },
    reason: { type: String, trim: true },
    items: { type: [creditNoteItemSchema], validate: (v) => v.length > 0 },
    totalQty: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    gstAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "confirmed"], default: "draft" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CreditNote", creditNoteSchema);
