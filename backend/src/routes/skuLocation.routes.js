const express = require("express");
const { requireAuth } = require("../middleware/auth");
const SkuLocation = require("../models/SkuLocation");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.enabled !== undefined) filter.enabled = req.query.enabled === "true";
    const locations = await SkuLocation.find(filter).populate("sku", "name uid").sort({ location: 1 });
    return res.json({ locations });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const location = await SkuLocation.create({ sku: req.body.sku, location: req.body.location });
    return res.status(201).json({ location });
  } catch (err) {
    return res.status(400).json({ error: err.code === 11000 ? "A SKU location with this name already exists" : err.message });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const location = await SkuLocation.findById(req.params.id);
    if (!location) return res.status(404).json({ error: "SKU location not found" });
    if (req.body.sku !== undefined) location.sku = req.body.sku;
    if (req.body.location !== undefined) location.location = req.body.location;
    if (req.body.enabled !== undefined) location.enabled = Boolean(req.body.enabled);
    await location.save();
    return res.json({ location });
  } catch (err) {
    return res.status(400).json({ error: err.code === 11000 ? "A SKU location with this name already exists" : err.message });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const location = await SkuLocation.findByIdAndDelete(req.params.id);
    if (!location) return res.status(404).json({ error: "SKU location not found" });
    return res.json({ message: "SKU location deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
