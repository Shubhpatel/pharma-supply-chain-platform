const express = require("express");
const { requireAuth } = require("../middleware/auth");
const Sku = require("../models/Sku");

const router = express.Router();

// GET /api/skus?enabled=true - pass enabled=true to get only the SKUs that
// should show up in Purchase/Sales product dropdowns.
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.enabled !== undefined) filter.enabled = req.query.enabled === "true";
    const skus = await Sku.find(filter).sort({ name: 1 });
    return res.json({ skus });
  } catch (err) {
    console.error("Server Error:", err); return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const sku = await Sku.findById(req.params.id);
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    return res.json({ sku });
  } catch (err) {
    console.error("Server Error:", err); return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const sku = await Sku.create(req.body);
    return res.status(201).json({ sku });
  } catch (err) {
    console.error("Server Error:", err); return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const sku = await Sku.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    return res.json({ sku });
  } catch (err) {
    console.error("Server Error:", err); return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/skus/:id/toggle - flip enabled on/off, the quick "remove from dropdowns" action
router.patch("/:id/toggle", requireAuth, async (req, res) => {
  try {
    const sku = await Sku.findById(req.params.id);
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    sku.enabled = !sku.enabled;
    await sku.save();
    return res.json({ sku });
  } catch (err) {
    console.error("Server Error:", err); return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const sku = await Sku.findByIdAndDelete(req.params.id);
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    return res.json({ message: "SKU deleted" });
  } catch (err) {
    console.error("Server Error:", err); return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
