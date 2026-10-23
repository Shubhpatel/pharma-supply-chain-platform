const mongoose = require("mongoose");

const assistantDraftSchema = new mongoose.Schema(
  {
    draftId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actionType: {
      type: String,
      required: true,
      enum: [
        "create_purchase_order",
        "create_sales_invoice",
        "create_grn",
        "create_debit_note",
        "create_credit_note",
        "update_sku",
        "toggle_sku",
        "delete_sku",
      ],
    },
    summary: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
    affectedEntities: [
      {
        entityType: { type: String, required: true },
        entityId: { type: String },
        name: { type: String, required: true },
      },
    ],
    proposedPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    validationWarnings: [
      {
        type: String,
      },
    ],
    estimatedImpact: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "executed", "expired", "failed"],
      default: "pending",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    idempotencyKey: {
      type: String,
      index: true,
    },
    approvalMetadata: {
      approvedAt: { type: Date },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    executionMetadata: {
      executedAt: { type: Date },
      executedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      resultRecordId: { type: String },
      errorDetails: { type: String },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AssistantDraft", assistantDraftSchema);
