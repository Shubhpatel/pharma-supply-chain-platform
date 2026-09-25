const express = require("express");
const { requireAuth } = require("../middleware/auth");
const Grn = require("../models/Grn");
const PurchaseOrder = require("../models/PurchaseOrder");
const SkuLocation = require("../models/SkuLocation");
const DebitNote = require("../models/DebitNote");
const Stock = require("../models/Stock");
const { nextNumber } = require("../utils/idGenerator");

const router = express.Router();

async function addSkuLocationSnapshots(items) {
  const skuIds = [...new Set(items.map((item) => String(item.sku)))];
  const locations = await SkuLocation.find({ sku: { $in: skuIds }, enabled: true }).select("sku location");
  const locationsBySku = new Map(locations.map((entry) => [String(entry.sku), entry.location]));
  return items.map((item) => ({ ...item, skuLocation: locationsBySku.get(String(item.sku)) || "" }));
}

// POST /api/grn  { purchaseOrderId, grnDate, purchaseInvoiceNumber, purchaseInvoiceDate, items: [{sku, skuName, qtyOrdered, qtyReceived, batch, expiryDate, mrp, rate}] }
// Creates the GRN, adds the received quantities to stock, and updates the PO's status.
router.post("/", requireAuth, async (req, res) => {
  try {
    const { purchaseOrderId, grnDate, purchaseInvoiceNumber, purchaseInvoiceDate, gstRate, items } = req.body;
    if (!purchaseOrderId || !grnDate || !purchaseInvoiceNumber?.trim() || !purchaseInvoiceDate || !items || items.length === 0) {
      return res.status(400).json({ error: "purchaseOrderId, grnDate, purchaseInvoiceNumber, purchaseInvoiceDate and at least one item are required" });
    }

    const po = await PurchaseOrder.findById(purchaseOrderId);
    if (!po) return res.status(404).json({ error: "Purchase order not found" });
    if (!["placed", "partially_received"].includes(po.status)) {
      return res.status(400).json({ error: "GRNs can only be created against confirmed purchase orders" });
    }

    const existingGrns = await Grn.find({ purchaseOrder: po._id, status: "confirmed" }).select("items.sku items.qtyReceived");
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
      const poItem = po.items.find((currentItem) => String(currentItem.sku) === skuId);
      if (!poItem) return res.status(400).json({ error: `SKU ${item.skuName || skuId} is not part of this purchase order` });
      if (Number(item.gstRate || 0) !== Number(poItem.gstRate || 0)) {
        return res.status(400).json({ error: `GST for ${item.skuName || skuId} must match the purchase order` });
      }
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

    const itemsWithAmount = await addSkuLocationSnapshots(items.map((i) => {
      const itemGstRate = Number(i.gstRate || 0);
      if (!Number.isFinite(itemGstRate) || itemGstRate < 0 || itemGstRate > 100) throw new Error("GST rate must be between 0 and 100");
      const amount = i.qtyReceived * i.rate;
      return { ...i, gstRate: itemGstRate, amount, gstAmount: amount * itemGstRate / 100 };
    }));
    const totalQty = itemsWithAmount.reduce((sum, i) => sum + i.qtyReceived, 0);
    const totalValue = itemsWithAmount.reduce((sum, i) => sum + i.amount, 0);
    const gstAmount = itemsWithAmount.reduce((sum, i) => sum + i.gstAmount, 0);
    const grnNumber = await nextNumber(Grn, "grnNumber", "GRN");

    const grn = await Grn.create({
      grnNumber,
      purchaseOrder: po._id,
      supplier: po.supplier,
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      grnDate,
      purchaseInvoiceNumber: purchaseInvoiceNumber.trim(),
      purchaseInvoiceDate,
      items: itemsWithAmount,
      totalQty,
      totalValue,
      gstRate: 0,
      gstAmount,
      grandTotal: totalValue + gstAmount,
      createdBy: req.user.id,
    });

    return res.status(201).json({ grn });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/grn/:id - updates a draft GRN before it affects inventory
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { grnDate, purchaseInvoiceNumber, purchaseInvoiceDate, items } = req.body;
    const grn = await Grn.findById(req.params.id);
    if (!grn) return res.status(404).json({ error: "GRN not found" });
    if (grn.status !== "draft") return res.status(400).json({ error: "Only draft GRNs can be edited" });
    if (!grnDate || !purchaseInvoiceNumber?.trim() || !purchaseInvoiceDate || !items || items.length === 0) {
      return res.status(400).json({ error: "grnDate, purchaseInvoiceNumber, purchaseInvoiceDate and at least one item are required" });
    }

    const po = await PurchaseOrder.findById(grn.purchaseOrder);
    if (!po || !["placed", "partially_received"].includes(po.status)) {
      return res.status(400).json({ error: "The linked purchase order is not confirmed" });
    }
    const existingGrns = await Grn.find({ purchaseOrder: po._id, status: "confirmed" }).select("items.sku items.qtyReceived");
    const receivedBySku = {};
    for (const existingGrn of existingGrns) {
      for (const item of existingGrn.items) receivedBySku[String(item.sku)] = (receivedBySku[String(item.sku)] || 0) + item.qtyReceived;
    }
    const orderedBySku = {};
    for (const item of po.items) orderedBySku[String(item.sku)] = (orderedBySku[String(item.sku)] || 0) + item.qty;
    const requestedBySku = {};
    for (const item of items) {
      const skuId = String(item.sku);
      const qtyReceived = Number(item.qtyReceived);
      const poItem = po.items.find((currentItem) => String(currentItem.sku) === skuId);
      if (!poItem) return res.status(400).json({ error: `SKU ${item.skuName || skuId} is not part of this purchase order` });
      if (Number(item.gstRate || 0) !== Number(poItem.gstRate || 0)) return res.status(400).json({ error: `GST for ${item.skuName || skuId} must match the purchase order` });
      if (!Number.isFinite(qtyReceived) || qtyReceived < 0) return res.status(400).json({ error: `Received quantity for ${item.skuName || skuId} must be a non-negative number` });
      requestedBySku[skuId] = (requestedBySku[skuId] || 0) + qtyReceived;
    }
    for (const [skuId, requestedQty] of Object.entries(requestedBySku)) {
      const pendingQty = orderedBySku[skuId] - (receivedBySku[skuId] || 0);
      if (requestedQty > pendingQty) return res.status(400).json({ error: `Received quantity for SKU ${skuId} exceeds the pending quantity of ${pendingQty}` });
    }
    const itemsWithAmount = await addSkuLocationSnapshots(items.map((i) => {
      const itemGstRate = Number(i.gstRate || 0);
      if (!Number.isFinite(itemGstRate) || itemGstRate < 0 || itemGstRate > 100) throw new Error("GST rate must be between 0 and 100");
      const amount = Number(i.qtyReceived) * Number(i.rate);
      return { ...i, qtyReceived: Number(i.qtyReceived), rate: Number(i.rate), mrp: Number(i.mrp), gstRate: itemGstRate, amount, gstAmount: amount * itemGstRate / 100 };
    }));
    const totalQty = itemsWithAmount.reduce((sum, i) => sum + i.qtyReceived, 0);
    const totalValue = itemsWithAmount.reduce((sum, i) => sum + i.amount, 0);
    const gstAmount = itemsWithAmount.reduce((sum, i) => sum + i.gstAmount, 0);
    Object.assign(grn, {
      grnDate,
      purchaseInvoiceNumber: purchaseInvoiceNumber.trim(),
      purchaseInvoiceDate,
      items: itemsWithAmount,
      totalQty,
      totalValue,
      gstRate: 0,
      gstAmount,
      grandTotal: totalValue + gstAmount,
    });
    await grn.save();
    return res.json({ grn });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/grn/:id - deletes a draft GRN
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const grn = await Grn.findById(req.params.id);
    if (!grn) return res.status(404).json({ error: "GRN not found" });
    if (grn.status !== "draft") return res.status(400).json({ error: "Only draft GRNs can be deleted" });
    await grn.deleteOne();
    return res.json({ message: "GRN deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/grn/:id/confirm - adds received stock and updates the linked PO
router.patch("/:id/confirm", requireAuth, async (req, res) => {
  try {
    const grn = await Grn.findById(req.params.id);
    if (!grn) return res.status(404).json({ error: "GRN not found" });
    if (grn.status !== "draft") return res.status(400).json({ error: "Only draft GRNs can be confirmed" });

    const po = await PurchaseOrder.findById(grn.purchaseOrder);
    if (!po || !["placed", "partially_received"].includes(po.status)) {
      return res.status(400).json({ error: "The linked purchase order is not confirmed" });
    }

    for (const item of grn.items) {
      await Stock.findOneAndUpdate(
        { sku: item.sku, batch: item.batch, expiryDate: item.expiryDate, mrp: item.mrp, rate: item.rate },
        { $inc: { qty: item.qtyReceived } },
        { upsert: true }
      );
    }

    const existingGrns = await Grn.find({ purchaseOrder: po._id, status: "confirmed" }).select("items.sku items.qtyReceived");
    const receivedBySku = {};
    for (const existingGrn of existingGrns) {
      for (const item of existingGrn.items) {
        receivedBySku[String(item.sku)] = (receivedBySku[String(item.sku)] || 0) + item.qtyReceived;
      }
    }
    for (const item of grn.items) {
      receivedBySku[String(item.sku)] = (receivedBySku[String(item.sku)] || 0) + item.qtyReceived;
    }
    const fullyReceived = po.items.every((item) => receivedBySku[String(item.sku)] >= item.qty);
    po.status = fullyReceived ? "received" : "partially_received";
    await po.save();

    grn.status = "confirmed";
    await grn.save();
    return res.json({ grn });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/grn - list (summary columns)
router.get("/", async (req, res) => {
  try {
    const grns = await Grn.find()
      .select("grnNumber poNumber supplierName grnDate purchaseInvoiceNumber purchaseInvoiceDate totalQty totalValue gstAmount grandTotal status")
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
      .populate("purchaseOrder", "poNumber")
      .populate("supplier");
    if (!grn) return res.status(404).json({ error: "GRN not found" });

    const linkedPurchaseReturns = await DebitNote.find({ grn: grn._id })
      .select("debitNoteNumber status returnDate createdAt")
      .sort({ createdAt: -1 });

    const grnPayload = grn.toObject();
    grnPayload.linkedPurchaseReturns = linkedPurchaseReturns;
    return res.json({ grn: grnPayload });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
