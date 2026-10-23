const express = require("express");
const XLSX = require("xlsx");
const { requireAuth } = require("../middleware/auth");
const SkuLocation = require("../models/SkuLocation");
const Sku = require("../models/Sku");
const { getPagination, paginationMeta } = require("../utils/pagination");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.enabled !== undefined) filter.enabled = req.query.enabled === "true";
    if (req.query.search) {
      const search = req.query.search.trim();
      if (search) {
        const matchingSkus = await Sku.find({ name: { $regex: search, $options: "i" } }).select("_id").lean();
        filter.$or = [
          { location: { $regex: search, $options: "i" } },
          { sku: { $in: matchingSkus.map((sku) => sku._id) } },
        ];
      }
    }
    // Performance optimization: Use .lean() for read-only queries to bypass document hydration
    // and return plain JS objects, significantly improving query speed and memory footprint.
    const { page, limit, skip } = getPagination(req.query);
    const [locations, total] = await Promise.all([
      SkuLocation.find(filter).populate("sku", "name uid").sort({ location: 1 }).skip(skip).limit(limit).lean(),
      SkuLocation.countDocuments(filter),
    ]);
    return res.json({ locations, pagination: paginationMeta(page, limit, total) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/export", requireAuth, async (req, res) => {
  try {
    // Performance optimization: Use .lean() for export query as documents are read-only plain objects
    const locations = await SkuLocation.find()
      .populate("sku", "name uid")
      .sort({ location: 1 })
      .lean();
    const rows = locations.map((entry) => ({
      "Product UID": entry.sku?.uid || "",
      SKU: entry.sku?.name || "",
      Location: entry.location,
      Status: entry.enabled ? "Enabled" : "Disabled",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: ["Product UID", "SKU", "Location", "Status"] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SKU Locations");
    const format = (req.query.format || "csv").toLowerCase();
    if (format === "xlsx" || format === "excel") {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=sku_locations.xlsx");
      return res.send(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=sku_locations.csv");
    return res.send(XLSX.utils.sheet_to_csv(worksheet));
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
