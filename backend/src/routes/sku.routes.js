const express = require("express");
const { requireAuth, requirePermission } = require("../middleware/auth");
const Sku = require("../models/Sku");

const router = express.Router();

router.get("/", requireAuth, requirePermission("masters", "po", "grn", "invoice", "sr", "pr"), async (req, res) => {
  try {
    const filter = {};
    if (req.query.enabled !== undefined) filter.enabled = req.query.enabled === "true";
    const skus = await Sku.find(filter).sort({ name: 1 });
    return res.json({ skus });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/:id", requireAuth, requirePermission("masters", "po", "grn", "invoice", "sr", "pr"), async (req, res) => {
  try {
    const sku = await Sku.findById(req.params.id);
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    return res.json({ sku });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/", requireAuth, requirePermission("masters"), async (req, res) => {
  try {
    const sku = await Sku.create(req.body);
    return res.status(201).json({ sku });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put("/:id", requireAuth, requirePermission("masters"), async (req, res) => {
  try {
    const sku = await Sku.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    return res.json({ sku });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/toggle", requireAuth, requirePermission("masters"), async (req, res) => {
  try {
    const sku = await Sku.findById(req.params.id);
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    sku.enabled = !sku.enabled;
    await sku.save();
    return res.json({ sku });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", requireAuth, requirePermission("masters"), async (req, res) => {
  try {
    const sku = await Sku.findByIdAndDelete(req.params.id);
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    return res.json({ message: "SKU deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
