const express = require("express");
const Stock = require("../models/Stock");

const router = express.Router();

// GET /api/inventory - stock on hand, joined with SKU details
router.get("/", async (req, res) => {
  try {
    const stock = await Stock.find({ qty: { $gt: 0 } }).populate("sku", "name category subCategory manufacturer uom");
    // Only show rows where the SKU still exists (in case one was hard-deleted from Masters).
    const rows = stock
      .filter((s) => s.sku)
      .map((s) => ({
        skuId: s.sku._id,
        name: s.sku.name,
        category: s.sku.category,
        subCategory: s.sku.subCategory,
        manufacturer: s.sku.manufacturer,
        uom: s.sku.uom,
        batch: s.batch,
        expiryDate: s.expiryDate,
        mrp: s.mrp,
        rate: s.rate,
        qty: s.qty,
      }));
    return res.json({ stock: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
