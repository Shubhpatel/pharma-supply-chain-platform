const mongoose = require("mongoose");

const assistantAuditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "chat_query",
        "draft_created",
        "draft_approved",
        "draft_rejected",
        "draft_executed",
        "draft_execution_failed",
      ],
    },
    draftId: {
      type: String,
      index: true,
    },
    actionType: {
      type: String,
    },
    affectedRecords: [
      {
        entityType: { type: String, required: true },
        entityId: { type: String },
        name: { type: String },
      },
    ],
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AssistantAuditLog", assistantAuditLogSchema);
