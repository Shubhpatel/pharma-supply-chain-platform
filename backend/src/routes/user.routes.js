const express = require("express");
const bcrypt = require("bcryptjs");
const { requireAuth, requirePermission } = require("../middleware/auth");
const User = require("../models/User");
const { getPagination, paginationMeta } = require("../utils/pagination");

const router = express.Router();

// All user management routes require auth + 'users' permission (or ADMIN)
router.use(requireAuth, requirePermission("users"));

// GET /api/users - List all users
router.get("/", async (req, res) => {
  try {
    // ⚡ Bolt: Added .lean() to bypass document hydration for read-only query
    const users = await User.find().select("-passwordHash").sort({ createdAt: -1 }).lean();
    return res.json({ users });
  } catch (err) {
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users - Create new user (Admin adding user)
router.post("/", async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const assignedRole = role || "ADMIN";
    const assignedPermissions = Array.isArray(permissions)
      ? permissions
      : User.getDefaultPermissions(assignedRole);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: assignedRole,
      permissions: assignedPermissions,
    });

    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (err) {
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/users/:id - Update user details, role, and permissions
router.put("/:id", async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (email && email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) return res.status(409).json({ error: "Email already registered to another user" });
      user.email = email.toLowerCase();
    }

    if (name) user.name = name;
    if (password) {
      user.passwordHash = await bcrypt.hash(password, 10);
    }
    if (role) {
      user.role = role;
    }
    if (permissions !== undefined) {
      user.permissions = Array.isArray(permissions) ? permissions : User.getDefaultPermissions(user.role);
    } else if (role && !permissions) {
      user.permissions = User.getDefaultPermissions(role);
    }

    await user.save();

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (err) {
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/users/:id - Delete a user
router.delete("/:id", async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
