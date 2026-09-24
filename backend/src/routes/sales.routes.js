const express = require("express");
const { requireAuth } = require("../middleware/auth");
const SaleInvoice = require("../models/SaleInvoice");
const Stock = require("../models/Stock");
const { nextNumber } = require("../utils/idGenerator");

const router = express.Router();

// POST /api/sales  { customerName, saleDate, items: [{sku, skuName, qty, rate}] }
router.post("/", requireAuth, async (req, res) => {
  try {
    const { customerName, saleDate, items } = req.body;
    if (!customerName || !saleDate || !items || items.length === 0) {
      return res.status(400).json({ error: "customerName, saleDate and at least one item are required" });
    }

    // Check stock availability for every line before committing anything.
    for (const item of items) {
      const stock = await Stock.findOne({ sku: item.sku });
      const available = stock ? stock.qty : 0;
      if (available < item.qty) {
        return res.status(400).json({ error: `Not enough stock for ${item.skuName}: have ${available}, need ${item.qty}` });
      }
    }

    const itemsWithAmount = items.map((i) => ({ ...i, amount: i.qty * i.rate }));
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
      await Stock.findOneAndUpdate({ sku: item.sku }, { $inc: { qty: -item.qty } });
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
