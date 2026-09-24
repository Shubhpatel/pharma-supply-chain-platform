const mongoose = require("mongoose");

const poItemSchema = new mongoose.Schema(
  {
    sku: { type: mongoose.Schema.Types.ObjectId, ref: "Sku", required: true },
    skuName: { type: String, required: true }, // snapshot, in case the SKU is edited/removed later
    qty: { type: Number, required: true, min: 1 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true }, // qty * rate
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true },
    supplierName: { type: String, required: true, trim: true },
    orderDate: { type: Date, required: true },
    paymentTerm: { type: String, default: "" }, // e.g. "Net 30", "Advance"
    expectedDeliveryDate: { type: Date },
    status: { type: String, enum: ["placed", "partially_received", "received", "cancelled"], default: "placed" },
    items: { type: [poItemSchema], validate: (v) => v.length > 0 },
    totalQty: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PurchaseOrder", purchaseOrderSchema);
