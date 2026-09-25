const mongoose = require("mongoose");

const debitNoteItemSchema = new mongoose.Schema(
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

const debitNoteSchema = new mongoose.Schema(
  {
    debitNoteNumber: { type: String, required: true, unique: true },
    grn: { type: mongoose.Schema.Types.ObjectId, ref: "Grn", required: true },
    grnNumber: { type: String, required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Party" },
    supplierName: { type: String, required: true },
    returnDate: { type: Date, required: true },
    reason: { type: String, trim: true },
    items: { type: [debitNoteItemSchema], validate: (v) => v.length > 0 },
    totalQty: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    gstAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DebitNote", debitNoteSchema);
