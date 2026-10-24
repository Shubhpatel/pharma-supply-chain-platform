const express = require("express");
const { requireAuth, requirePermission } = require("../middleware/auth");
const crypto = require("crypto");
const XLSX = require("xlsx");
const Sku = require("../models/Sku");

const router = express.Router();

router.get("/", requireAuth, requirePermission("masters", "po", "grn", "invoice", "sr", "pr"), async (req, res) => {
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
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/export", requireAuth, async (req, res) => {
  try {
    // ⚡ Bolt: Added .lean() to bypass document hydration for read-only export
    const skus = await Sku.find().sort({ name: 1 }).lean();
    const rows = skus.map((sku) => ({
      "Master UID": sku.uid || "",
      Name: sku.name,
      "HSN Code": sku.hsnCode || "",
      Category: sku.category || "",
      "Sub Category": sku.subCategory || "",
      Manufacturer: sku.manufacturer || "",
      UOM: sku.uom || "",
      MRP: sku.mrp,
      Status: sku.enabled ? "Enabled" : "Disabled",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: ["Master UID", "Name", "HSN Code", "Category", "Sub Category", "Manufacturer", "UOM", "MRP", "Status"] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SKUs");
    const format = (req.query.format || "csv").toLowerCase();
    if (format === "xlsx" || format === "excel") {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=skus.xlsx");
      return res.send(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=skus.csv");
    return res.send(XLSX.utils.sheet_to_csv(worksheet));
  } catch (err) {
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, requirePermission("masters", "po", "grn", "invoice", "sr", "pr"), async (req, res) => {
  try {
    const sku = await Sku.findById(req.params.id);
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    return res.json({ sku });
  } catch (err) {
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, requirePermission("masters"), async (req, res) => {
  try {
    const payload = { ...req.body };
    delete payload.uid;
    delete payload._id;
    payload.name = typeof payload.name === "string" ? payload.name.trim() : payload.name;
    const duplicate = await Sku.findOne({ name: payload.name }).collation({ locale: "en", strength: 2 });
    if (duplicate) return res.status(409).json({ error: "A SKU with this name already exists" });
    const sku = await Sku.create(payload);
    return res.status(201).json({ sku });
  } catch (err) {
    return res.status(err.code === 11000 ? 409 : 500).json({
      error: err.code === 11000 ? "A SKU with this name already exists" : err.message,
    });
  }
});

router.put("/:id", requireAuth, requirePermission("masters"), async (req, res) => {
  try {
    const sku = await Sku.findById(req.params.id);
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    const changes = { ...req.body };
    delete changes.uid;
    delete changes._id;
    if (changes.name !== undefined) {
      changes.name = typeof changes.name === "string" ? changes.name.trim() : changes.name;
      const duplicate = await Sku.findOne({ name: changes.name, _id: { $ne: sku._id } })
        .collation({ locale: "en", strength: 2 });
      if (duplicate) return res.status(409).json({ error: "A SKU with this name already exists" });
    }
    Object.assign(sku, changes);
    if (!sku.uid) sku.uid = crypto.randomUUID();
    await sku.save();
    return res.json({ sku });
  } catch (err) {
    return res.status(err.code === 11000 ? 409 : 500).json({
      error: err.code === 11000 ? "A SKU with this name already exists" : err.message,
    });
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
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAuth, requirePermission("masters"), async (req, res) => {
  try {
    const sku = await Sku.findByIdAndDelete(req.params.id);
    if (!sku) return res.status(404).json({ error: "SKU not found" });
    return res.json({ message: "SKU deleted" });
  } catch (err) {
    console.error("Internal Server Error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
