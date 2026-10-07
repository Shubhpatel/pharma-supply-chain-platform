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
    if (grn.status !== "confirmed") return res.status(400).json({ error: "Purchase returns require a confirmed GRN" });

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

    return res.status(201).json({ debitNote });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/debit-notes/:id - update a draft purchase return
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { grnId, returnDate, reason, items } = req.body;
    const debitNote = await DebitNote.findById(req.params.id);
    if (!debitNote) return res.status(404).json({ error: "Debit note not found" });
    if (debitNote.status !== "draft") return res.status(400).json({ error: "Only draft debit notes can be edited" });
    if (!grnId || !returnDate || !items || items.length === 0) {
      return res.status(400).json({ error: "grnId, returnDate and at least one item are required" });
    }

    const grn = await Grn.findById(grnId);
    if (!grn) return res.status(404).json({ error: "GRN not found" });
    if (grn.status !== "confirmed") return res.status(400).json({ error: "Purchase returns require a confirmed GRN" });

    const existingDebitNotes = await DebitNote.find({ grn: grn._id, _id: { $ne: debitNote._id } });
    const returnedQtyBySkuBatch = {};
    for (const dn of existingDebitNotes) {
      for (const item of dn.items) {
        const key = `${item.sku}_${item.batch}`;
        returnedQtyBySkuBatch[key] = (returnedQtyBySkuBatch[key] || 0) + item.qty;
      }
    }

    const itemsToReturn = [];
    for (const item of items) {
      const returnQty = Number(item.qty || 0);
      if (returnQty <= 0) continue;

      const grnItem = grn.items.find((gi) => String(gi.sku) === String(item.sku) && gi.batch === item.batch);
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

    Object.assign(debitNote, {
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
    });
    await debitNote.save();
    return res.json({ debitNote });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/debit-notes/:id - delete a draft purchase return
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const debitNote = await DebitNote.findById(req.params.id);
    if (!debitNote) return res.status(404).json({ error: "Debit note not found" });
    if (debitNote.status !== "draft") return res.status(400).json({ error: "Only draft debit notes can be deleted" });
    await debitNote.deleteOne();
    return res.json({ message: "Debit note deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/debit-notes/:id/confirm - deducts returned stock
router.patch("/:id/confirm", requireAuth, async (req, res) => {
  try {
    const debitNote = await DebitNote.findById(req.params.id);
    if (!debitNote) return res.status(404).json({ error: "Debit note not found" });
    if (debitNote.status !== "draft") return res.status(400).json({ error: "Only draft debit notes can be confirmed" });

    const grn = await Grn.findById(debitNote.grn);
    if (!grn || grn.status !== "confirmed") return res.status(400).json({ error: "The linked GRN is not confirmed" });
    for (const item of debitNote.items) {
      const matchingStocks = await Stock.find({ sku: item.sku, batch: item.batch, expiryDate: item.expiryDate, mrp: item.mrp, rate: item.rate });
      const available = matchingStocks.reduce((sum, stock) => sum + stock.qty, 0);
      if (available < item.qty) return res.status(400).json({ error: `Insufficient available stock for ${item.skuName} (${item.batch})` });
    }
    for (const item of debitNote.items) {
      const matchingStocks = await Stock.find({ sku: item.sku, batch: item.batch, expiryDate: item.expiryDate, mrp: item.mrp, rate: item.rate }).sort({ createdAt: 1 });
      let remaining = item.qty;
      for (const stock of matchingStocks) {
        if (remaining <= 0) break;
        const deduct = Math.min(remaining, stock.qty);
        await Stock.findByIdAndUpdate(stock._id, { $inc: { qty: -deduct } });
        remaining -= deduct;
      }
    }
    debitNote.status = "confirmed";
    await debitNote.save();
    return res.json({ debitNote });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/debit-notes - list summary
router.get("/", requireAuth, async (req, res) => {
  try {
    const debitNotes = await DebitNote.find()
      .select("debitNoteNumber grnNumber supplierName returnDate totalQty totalAmount gstAmount grandTotal reason status")
      .sort({ createdAt: -1 });
    return res.json({ debitNotes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/debit-notes/:id - full detail
router.get("/:id", requireAuth, async (req, res) => {
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
