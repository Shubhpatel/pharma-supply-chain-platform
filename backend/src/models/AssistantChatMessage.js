const mongoose = require("mongoose");

const assistantChatMessageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      maxlength: 10000,
    },
    source: {
      type: String,
      default: "Database analysis",
    },
  },
  { timestamps: true }
);

assistantChatMessageSchema.index({ user: 1, createdAt: 1 });

module.exports = mongoose.model("AssistantChatMessage", assistantChatMessageSchema);
