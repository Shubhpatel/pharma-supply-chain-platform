const express = require("express");
const { requireAuth, requirePermission } = require("../middleware/auth");
const CreditNote = require("../models/CreditNote");
const SaleInvoice = require("../models/SaleInvoice");
const Stock = require("../models/Stock");
const { nextNumber } = require("../utils/idGenerator");

const router = express.Router();

// POST /api/credit-notes
router.post("/", requireAuth, requirePermission("sr"), async (req, res) => {
  try {
    const { invoiceId, returnDate, reason, items } = req.body;
    if (!invoiceId || !returnDate || !items || items.length === 0) {
      return res.status(400).json({ error: "invoiceId, returnDate and at least one item are required" });
    }

    const saleInvoice = await SaleInvoice.findById(invoiceId);
    if (!saleInvoice) return res.status(404).json({ error: "Sales invoice not found" });
    if (saleInvoice.status !== "confirmed") return res.status(400).json({ error: "Sales returns require a confirmed invoice" });

    const existingCreditNotes = await CreditNote.find({ saleInvoice: saleInvoice._id });
    const returnedQtyBySkuBatch = {};
    for (const cn of existingCreditNotes) {
      for (const item of cn.items) {
        const key = `${item.sku}_${item.batch}`;
        returnedQtyBySkuBatch[key] = (returnedQtyBySkuBatch[key] || 0) + item.qty;
      }
    }

    const itemsToReturn = [];
    for (const item of items) {
      const returnQty = Number(item.qty || 0);
      if (returnQty <= 0) continue;

      const invoiceItem = saleInvoice.items.find(
        (si) => String(si.sku) === String(item.sku) && si.batch === item.batch
      );
      if (!invoiceItem) {
        return res.status(400).json({ error: `Item ${item.skuName || item.sku} (${item.batch}) was not in sales invoice` });
      }

      const key = `${item.sku}_${item.batch}`;
      const alreadyReturned = returnedQtyBySkuBatch[key] || 0;
      const maxReturnable = invoiceItem.qty - alreadyReturned;

      if (returnQty > maxReturnable) {
        return res.status(400).json({
          error: `Return quantity (${returnQty}) for ${invoiceItem.skuName} (${invoiceItem.batch}) exceeds maximum returnable quantity (${maxReturnable})`,
        });
      }

      const rate = Number(invoiceItem.rate);
      const amount = returnQty * rate;
      const gstRate = Number(invoiceItem.gstRate || 0);
      const gstAmount = (amount * gstRate) / 100;

      itemsToReturn.push({
        sku: invoiceItem.sku,
        skuName: invoiceItem.skuName,
        batch: invoiceItem.batch,
        expiryDate: invoiceItem.expiryDate,
        mrp: invoiceItem.mrp,
        rate: invoiceItem.rate,
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
    const creditNoteNumber = await nextNumber(CreditNote, "creditNoteNumber", "CN");

    const creditNote = await CreditNote.create({
      creditNoteNumber,
      saleInvoice: saleInvoice._id,
      invoiceNumber: saleInvoice.invoiceNumber,
      customer: saleInvoice.customer,
      customerName: saleInvoice.customerName,
      returnDate,
      reason: reason || "",
      items: itemsToReturn,
      totalQty,
      totalAmount,
      gstAmount,
      grandTotal: totalAmount + gstAmount,
      createdBy: req.user.id,
    });

    return res.status(201).json({ creditNote });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/credit-notes/:id
router.put("/:id", requireAuth, requirePermission("sr"), async (req, res) => {
  try {
    const { invoiceId, returnDate, reason, items } = req.body;
    const creditNote = await CreditNote.findById(req.params.id);
    if (!creditNote) return res.status(404).json({ error: "Credit note not found" });
    if (creditNote.status !== "draft" && req.user.role !== "ADMIN") return res.status(400).json({ error: "Only draft credit notes can be edited" });
    if (!invoiceId || !returnDate || !items || items.length === 0) {
      return res.status(400).json({ error: "invoiceId, returnDate and at least one item are required" });
    }

    const saleInvoice = await SaleInvoice.findById(invoiceId);
    if (!saleInvoice) return res.status(404).json({ error: "Sales invoice not found" });
    if (saleInvoice.status !== "confirmed") return res.status(400).json({ error: "Sales returns require a confirmed invoice" });

    const existingCreditNotes = await CreditNote.find({ saleInvoice: saleInvoice._id, _id: { $ne: creditNote._id } });
    const returnedQtyBySkuBatch = {};
    for (const cn of existingCreditNotes) {
      for (const item of cn.items) {
        const key = `${item.sku}_${item.batch}`;
        returnedQtyBySkuBatch[key] = (returnedQtyBySkuBatch[key] || 0) + item.qty;
      }
    }

    const itemsToReturn = [];
    for (const item of items) {
      const returnQty = Number(item.qty || 0);
      if (returnQty <= 0) continue;

      const invoiceItem = saleInvoice.items.find((si) => String(si.sku) === String(item.sku) && si.batch === item.batch);
      if (!invoiceItem) {
        return res.status(400).json({ error: `Item ${item.skuName || item.sku} (${item.batch}) was not in sales invoice` });
      }

      const key = `${item.sku}_${item.batch}`;
      const alreadyReturned = returnedQtyBySkuBatch[key] || 0;
      const maxReturnable = invoiceItem.qty - alreadyReturned;

      if (returnQty > maxReturnable) {
        return res.status(400).json({
          error: `Return quantity (${returnQty}) for ${invoiceItem.skuName} (${invoiceItem.batch}) exceeds maximum returnable quantity (${maxReturnable})`,
        });
      }

      const rate = Number(invoiceItem.rate);
      const amount = returnQty * rate;
      const gstRate = Number(invoiceItem.gstRate || 0);
      const gstAmount = (amount * gstRate) / 100;

      itemsToReturn.push({
        sku: invoiceItem.sku,
        skuName: invoiceItem.skuName,
        batch: invoiceItem.batch,
        expiryDate: invoiceItem.expiryDate,
        mrp: invoiceItem.mrp,
        rate: invoiceItem.rate,
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

    Object.assign(creditNote, {
      saleInvoice: saleInvoice._id,
      invoiceNumber: saleInvoice.invoiceNumber,
      customer: saleInvoice.customer,
      customerName: saleInvoice.customerName,
      returnDate,
      reason: reason || "",
      items: itemsToReturn,
      totalQty,
      totalAmount,
      gstAmount,
      grandTotal: totalAmount + gstAmount,
    });
    await creditNote.save();
    return res.json({ creditNote });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/credit-notes/:id
router.delete("/:id", requireAuth, requirePermission("sr"), async (req, res) => {
  try {
    const creditNote = await CreditNote.findById(req.params.id);
    if (!creditNote) return res.status(404).json({ error: "Credit note not found" });
    if (creditNote.status !== "draft" && req.user.role !== "ADMIN") return res.status(400).json({ error: "Only draft credit notes can be deleted" });
    await creditNote.deleteOne();
    return res.json({ message: "Credit note deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/credit-notes/:id/confirm
router.patch("/:id/confirm", requireAuth, requirePermission("sr"), async (req, res) => {
  try {
    const creditNote = await CreditNote.findById(req.params.id);
    if (!creditNote) return res.status(404).json({ error: "Credit note not found" });
    if (creditNote.status !== "draft") return res.status(400).json({ error: "Only draft credit notes can be confirmed" });
    const saleInvoice = await SaleInvoice.findById(creditNote.saleInvoice);
    if (!saleInvoice || saleInvoice.status !== "confirmed") return res.status(400).json({ error: "The linked sales invoice is not confirmed" });
    for (const item of creditNote.items) {
      await Stock.findOneAndUpdate(
        { sku: item.sku, batch: item.batch, expiryDate: item.expiryDate, mrp: item.mrp, rate: item.rate },
        { $inc: { qty: item.qty } },
        { upsert: true }
      );
    }
    creditNote.status = "confirmed";
    await creditNote.save();
    return res.json({ creditNote });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/credit-notes
router.get("/", requireAuth, requirePermission("sr"), async (req, res) => {
  try {
    // Performance: .lean() returns plain JS objects to bypass Mongoose document hydration
    const creditNotes = await CreditNote.find()
      .select("creditNoteNumber invoiceNumber customerName returnDate totalQty totalAmount gstAmount grandTotal reason status")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ creditNotes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/credit-notes/:id
router.get("/:id", requireAuth, requirePermission("sr"), async (req, res) => {
  try {
    // Performance: .lean() bypasses Mongoose document hydration for read-only query
    const creditNote = await CreditNote.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("saleInvoice")
      .populate("customer")
      .lean();
    if (!creditNote) return res.status(404).json({ error: "Credit note not found" });
    return res.json({ creditNote });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
