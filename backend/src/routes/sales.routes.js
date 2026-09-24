const express = require("express");
const { requireAuth } = require("../middleware/auth");
const SaleInvoice = require("../models/SaleInvoice");
const Stock = require("../models/Stock");
const { nextNumber } = require("../utils/idGenerator");

const router = express.Router();

// POST /api/sales  { customerName, saleDate, items: [{sku, skuName, batch, expiryDate, mrp, qty, rate}] }
router.post("/", requireAuth, async (req, res) => {
  try {
    const { customerName, saleDate, items } = req.body;
    if (!customerName || !saleDate || !items || items.length === 0) {
      return res.status(400).json({ error: "customerName, saleDate and at least one item are required" });
    }

    const itemsWithAmount = items.map((i) => ({
      ...i,
      batch: String(i.batch || "").trim(),
      qty: Number(i.qty),
      rate: Number(i.rate),
      mrp: Number(i.mrp),
      amount: Number(i.qty) * Number(i.rate),
    }));

    // Check batch-specific stock availability before committing anything.
    for (const item of itemsWithAmount) {
      if (!item.batch) {
        return res.status(400).json({ error: `Batch is required for ${item.skuName}` });
      }
      if (!item.expiryDate) {
        return res.status(400).json({ error: `Expiry date is required for ${item.skuName} (${item.batch})` });
      }
      if (Number.isNaN(item.mrp) || item.mrp < 0) {
        return res.status(400).json({ error: `MRP is required for ${item.skuName} (${item.batch})` });
      }

      const stockRecords = await Stock.find({ sku: item.sku, batch: item.batch });
      const available = stockRecords.reduce((sum, stock) => sum + stock.qty, 0);
      if (available < item.qty) {
        return res.status(400).json({ error: `Not enough stock for ${item.skuName} (${item.batch}): have ${available}, need ${item.qty}` });
      }
    }

    const totalQty = itemsWithAmount.reduce((sum, i) => sum + i.qty, 0);
    const totalAmount = itemsWithAmount.reduce((sum, i) => sum + i.amount, 0);
    const invoiceNumber = await nextNumber(SaleInvoice, "invoiceNumber", "INV");

    const invoice = await SaleInvoice.create({
      invoiceNumber,
      customerName,
      saleDate,
      items: itemsWithAmount,
      totalQty,
      totalAmount,
      createdBy: req.user.id,
    });

    for (const item of itemsWithAmount) {
      const matchingStocks = await Stock.find({ sku: item.sku, batch: item.batch }).sort({ expiryDate: 1, rate: 1, mrp: 1 });
      let remaining = item.qty;

      for (const stock of matchingStocks) {
        if (remaining <= 0) break;
        const consumed = Math.min(remaining, stock.qty);
        await Stock.findByIdAndUpdate(stock._id, { $inc: { qty: -consumed } });
        remaining -= consumed;
      }

      if (remaining > 0) {
        throw new Error(`Unable to allocate ${remaining} units for ${item.skuName} (${item.batch}) from stock`);
      }
    }

    return res.status(201).json({ invoice });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/sales - list (summary columns)
router.get("/", async (req, res) => {
  try {
    const invoices = await SaleInvoice.find()
      .select("invoiceNumber customerName saleDate totalQty totalAmount")
      .sort({ createdAt: -1 });
    return res.json({ invoices });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/sales/:id - full invoice detail
router.get("/:id", async (req, res) => {
  try {
    const invoice = await SaleInvoice.findById(req.params.id).populate("createdBy", "name");
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    return res.json({ invoice });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
