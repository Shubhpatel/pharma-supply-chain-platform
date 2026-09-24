const express = require("express");
const { requireAuth } = require("../middleware/auth");
const DebitNote = require("../models/DebitNote");
const Grn = require("../models/Grn");
const Stock = require("../models/Stock");
const { nextNumber } = require("../utils/idGenerator");

const router = express.Router();

// POST /api/debit-notes
router.post("/", requireAuth, async (req, res) => {
  try {
    const { grnId, returnDate, reason, items } = req.body;
    if (!grnId || !returnDate || !items || items.length === 0) {
      return res.status(400).json({ error: "grnId, returnDate and at least one item are required" });
    }

    const grn = await Grn.findById(grnId);
    if (!grn) return res.status(404).json({ error: "GRN not found" });

    // Fetch existing debit notes for this GRN to calculate already returned quantities
    const existingDebitNotes = await DebitNote.find({ grn: grn._id });
    const returnedQtyBySkuBatch = {};
    for (const dn of existingDebitNotes) {
      for (const item of dn.items) {
        const key = `${item.sku}_${item.batch}`;
        returnedQtyBySkuBatch[key] = (returnedQtyBySkuBatch[key] || 0) + item.qty;
      }
    }

    // Process and validate items
    const itemsToReturn = [];
    for (const item of items) {
      const returnQty = Number(item.qty || 0);
      if (returnQty <= 0) continue;

      // Find item in original GRN
      const grnItem = grn.items.find(
        (gi) => String(gi.sku) === String(item.sku) && gi.batch === item.batch
      );
      if (!grnItem) {
        return res.status(400).json({ error: `Item ${item.skuName || item.sku} (${item.batch}) was not in GRN` });
      }

      const key = `${item.sku}_${item.batch}`;
      const alreadyReturned = returnedQtyBySkuBatch[key] || 0;
      const maxReturnable = grnItem.qtyReceived - alreadyReturned;

      if (returnQty > maxReturnable) {
        return res.status(400).json({
          error: `Return quantity (${returnQty}) for ${grnItem.skuName} (${grnItem.batch}) exceeds maximum returnable quantity (${maxReturnable})`,
        });
      }

      // Check current stock availability
      const matchingStocks = await Stock.find({
        sku: grnItem.sku,
        batch: grnItem.batch,
        expiryDate: grnItem.expiryDate,
        mrp: grnItem.mrp,
        rate: grnItem.rate,
      });

      const totalAvailableStock = matchingStocks.reduce((sum, s) => sum + s.qty, 0);
      if (totalAvailableStock < returnQty) {
        return res.status(400).json({
          error: `Insufficient available stock for ${grnItem.skuName} (${grnItem.batch}): needed ${returnQty}, current stock is ${totalAvailableStock}`,
        });
      }

      const rate = Number(grnItem.rate);
      const amount = returnQty * rate;
      const gstRate = Number(grnItem.gstRate || 0);
      const gstAmount = (amount * gstRate) / 100;

      itemsToReturn.push({
        sku: grnItem.sku,
        skuName: grnItem.skuName,
        batch: grnItem.batch,
        expiryDate: grnItem.expiryDate,
        mrp: grnItem.mrp,
        rate: grnItem.rate,
        qty: returnQty,
        amount,
        gstRate,
        gstAmount,
      });
    }

    if (itemsToReturn.length === 0) {
      return res.status(400).json({ error: "At least one item with return quantity greater than 0 is required" });
    }

    const totalQty = itemsToReturn.reduce((sum, i) => sum + i.qty, 0);
    const totalAmount = itemsToReturn.reduce((sum, i) => sum + i.amount, 0);
    const gstAmount = itemsToReturn.reduce((sum, i) => sum + i.gstAmount, 0);
    const debitNoteNumber = await nextNumber(DebitNote, "debitNoteNumber", "DN");

    const debitNote = await DebitNote.create({
      debitNoteNumber,
      grn: grn._id,
      grnNumber: grn.grnNumber,
      supplier: grn.supplier,
      supplierName: grn.supplierName,
      returnDate,
      reason: reason || "",
      items: itemsToReturn,
      totalQty,
      totalAmount,
      gstAmount,
      grandTotal: totalAmount + gstAmount,
      createdBy: req.user.id,
    });

    // Deduct stock from inventory
    for (const item of itemsToReturn) {
      const matchingStocks = await Stock.find({
        sku: item.sku,
        batch: item.batch,
        expiryDate: item.expiryDate,
        mrp: item.mrp,
        rate: item.rate,
      }).sort({ createdAt: 1 });

      let remainingToDeduct = item.qty;
      for (const stock of matchingStocks) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(remainingToDeduct, stock.qty);
        await Stock.findByIdAndUpdate(stock._id, { $inc: { qty: -deduct } });
        remainingToDeduct -= deduct;
      }
    }

    return res.status(201).json({ debitNote });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/debit-notes - list summary
router.get("/", async (req, res) => {
  try {
    const debitNotes = await DebitNote.find()
      .select("debitNoteNumber grnNumber supplierName returnDate totalQty totalAmount gstAmount grandTotal reason")
      .sort({ createdAt: -1 });
    return res.json({ debitNotes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/debit-notes/:id - full detail
router.get("/:id", async (req, res) => {
  try {
    const debitNote = await DebitNote.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("grn")
      .populate("supplier");
    if (!debitNote) return res.status(404).json({ error: "Debit note not found" });
    return res.json({ debitNote });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
