const express = require("express");
const crypto = require("crypto");
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
    await Promise.all(skus.filter((sku) => !sku.uid).map(async (sku) => {
      sku.uid = crypto.randomUUID();
      await sku.save();
    }));
    return res.json({ skus });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const sku = await Sku.findById(req.params.id);
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    return res.json({ sku });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const payload = { ...req.body };
    delete payload.uid;
    delete payload._id;
    const sku = await Sku.create(payload);
    return res.status(201).json({ sku });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const sku = await Sku.findById(req.params.id);
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    const changes = { ...req.body };
    delete changes.uid;
    delete changes._id;
    Object.assign(sku, changes);
    if (!sku.uid) sku.uid = crypto.randomUUID();
    await sku.save();
    return res.json({ sku });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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
    return res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const sku = await Sku.findByIdAndDelete(req.params.id);
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    return res.json({ message: "SKU deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
