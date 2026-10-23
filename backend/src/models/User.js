const mongoose = require("mongoose");

const ALL_PERMISSIONS = ["po", "grn", "pr", "invoice", "sr", "inventory", "masters", "reports", "users"];

const ROLE_PERMISSIONS = {
  PURCHASE: ["po"],
  GRN: ["grn", "pr"],
  SALES: ["invoice", "sr"],
  ADMIN: ALL_PERMISSIONS,
};

function getDefaultPermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["ADMIN", "PURCHASE", "GRN", "SALES", "CUSTOM"],
      default: "ADMIN",
    },
    permissions: {
      type: [String],
      default: function () {
        return getDefaultPermissions(this.role);
      },
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

userSchema.statics.ALL_PERMISSIONS = ALL_PERMISSIONS;
userSchema.statics.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
userSchema.statics.getDefaultPermissions = getDefaultPermissions;

module.exports = mongoose.model("User", userSchema);
