const mongoose = require("mongoose");

const bulkUploadSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    masterType: { type: String, enum: ["sku", "vendor", "customer", "sku-location", "purchase-order"], required: true },
    status: { type: String, enum: ["uploaded", "done", "error"], default: "uploaded" },
    totalRecords: { type: Number, default: 0 },
    successRecords: { type: Number, default: 0 },
    errorRecords: { type: Number, default: 0 },
    errorDetails: [
      {
        rowNumber: Number,
        data: mongoose.Schema.Types.Mixed,
        errorList: [String],
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BulkUpload", bulkUploadSchema);
