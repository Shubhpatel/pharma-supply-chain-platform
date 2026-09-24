const express = require("express");
const { requireAuth } = require("../middleware/auth");
const Grn = require("../models/Grn");
const PurchaseOrder = require("../models/PurchaseOrder");
const Stock = require("../models/Stock");
const { nextNumber } = require("../utils/idGenerator");

const router = express.Router();

// POST /api/grn  { purchaseOrderId, grnDate, purchaseInvoiceNumber, purchaseInvoiceDate, items: [{sku, skuName, qtyOrdered, qtyReceived, batch, expiryDate, mrp, rate}] }
// Creates the GRN, adds the received quantities to stock, and updates the PO's status.
router.post("/", requireAuth, async (req, res) => {
  try {
    const { purchaseOrderId, grnDate, purchaseInvoiceNumber, purchaseInvoiceDate, items } = req.body;
    if (!purchaseOrderId || !grnDate || !purchaseInvoiceNumber?.trim() || !purchaseInvoiceDate || !items || items.length === 0) {
      return res.status(400).json({ error: "purchaseOrderId, grnDate, purchaseInvoiceNumber, purchaseInvoiceDate and at least one item are required" });
    }

    const po = await PurchaseOrder.findById(purchaseOrderId);
    if (!po) return res.status(404).json({ error: "Purchase order not found" });

    const existingGrns = await Grn.find({ purchaseOrder: po._id }).select("items.sku items.qtyReceived");
    const receivedBySku = {};
    for (const grn of existingGrns) {
      for (const item of grn.items) {
        receivedBySku[String(item.sku)] = (receivedBySku[String(item.sku)] || 0) + item.qtyReceived;
      }
    }

    const orderedBySku = {};
    for (const item of po.items) orderedBySku[String(item.sku)] = (orderedBySku[String(item.sku)] || 0) + item.qty;

    const requestedBySku = {};
    for (const item of items) {
      const skuId = String(item.sku);
      const qtyReceived = Number(item.qtyReceived);
      if (!orderedBySku[skuId]) return res.status(400).json({ error: `SKU ${item.skuName || skuId} is not part of this purchase order` });
      if (!Number.isFinite(qtyReceived) || qtyReceived < 0) {
        return res.status(400).json({ error: `Received quantity for ${item.skuName || skuId} must be a non-negative number` });
      }
      requestedBySku[skuId] = (requestedBySku[skuId] || 0) + qtyReceived;
    }

    for (const [skuId, requestedQty] of Object.entries(requestedBySku)) {
      const pendingQty = orderedBySku[skuId] - (receivedBySku[skuId] || 0);
      if (requestedQty > pendingQty) {
        return res.status(400).json({ error: `Received quantity for SKU ${skuId} exceeds the pending quantity of ${pendingQty}` });
      }
    }

    const itemsWithAmount = items.map((i) => ({ ...i, amount: i.qtyReceived * i.rate }));
    const totalQty = itemsWithAmount.reduce((sum, i) => sum + i.qtyReceived, 0);
    const totalValue = itemsWithAmount.reduce((sum, i) => sum + i.amount, 0);
    const grnNumber = await nextNumber(Grn, "grnNumber", "GRN");

    const grn = await Grn.create({
      grnNumber,
      purchaseOrder: po._id,
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      grnDate,
      purchaseInvoiceNumber: purchaseInvoiceNumber.trim(),
      purchaseInvoiceDate,
      items: itemsWithAmount,
      totalQty,
      totalValue,
      createdBy: req.user.id,
    });

    // Keep stock separated by lot and pricing details.
    for (const item of itemsWithAmount) {
      await Stock.findOneAndUpdate(
        { sku: item.sku, batch: item.batch, expiryDate: item.expiryDate, mrp: item.mrp, rate: item.rate },
        { $inc: { qty: item.qtyReceived } },
        { upsert: true }
      );
    }

    // Figure out if the PO is now fully received, or only partially.
    const totalReceivedBySku = { ...receivedBySku };
    for (const [skuId, qty] of Object.entries(requestedBySku)) {
      totalReceivedBySku[skuId] = (totalReceivedBySku[skuId] || 0) + qty;
    }
    const fullyReceived = Object.keys(orderedBySku).every(
      (skuId) => (totalReceivedBySku[skuId] || 0) >= orderedBySku[skuId]
    );

    po.status = fullyReceived ? "received" : "partially_received";
    await po.save();

    return res.status(201).json({ grn });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/grn - list (summary columns)
router.get("/", async (req, res) => {
  try {
    const grns = await Grn.find()
      .select("grnNumber poNumber supplierName grnDate purchaseInvoiceNumber purchaseInvoiceDate totalQty totalValue status")
      .sort({ createdAt: -1 });
    return res.json({ grns });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/grn/:id - full detail
router.get("/:id", async (req, res) => {
  try {
    const grn = await Grn.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("purchaseOrder", "poNumber");
    if (!grn) return res.status(404).json({ error: "GRN not found" });
    return res.json({ grn });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
