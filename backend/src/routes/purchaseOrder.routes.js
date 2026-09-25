const express = require("express");
const { requireAuth, requirePermission } = require("../middleware/auth");
const PurchaseOrder = require("../models/PurchaseOrder");
const Grn = require("../models/Grn");
const Party = require("../models/Party");
const { nextNumber } = require("../utils/idGenerator");

const router = express.Router();

function addPendingQuantities(po, receivedBySku) {
  const items = po.items.map((item) => ({
    ...item.toObject(),
    pendingQty: Math.max(0, item.qty - (receivedBySku[String(item.sku)] || 0)),
  }));
  return {
    ...po.toObject(),
    items,
    pendingQty: items.reduce((sum, item) => sum + item.pendingQty, 0),
  };
}

async function receivedQuantitiesByPo(poIds) {
  const received = await Grn.aggregate([
    { $match: { purchaseOrder: { $in: poIds } } },
    { $unwind: "$items" },
    { $group: { _id: { purchaseOrder: "$purchaseOrder", sku: "$items.sku" }, qty: { $sum: "$items.qtyReceived" } } },
  ]);
  const byPo = {};
  for (const row of received) {
    const poId = String(row._id.purchaseOrder);
    if (!byPo[poId]) byPo[poId] = {};
    byPo[poId][String(row._id.sku)] = row.qty;
  }
  return byPo;
}

// POST /api/purchase-orders
router.post("/", requireAuth, requirePermission("po"), async (req, res) => {
  try {
    const { supplierId, supplierName, orderDate, paymentTerm, expectedDeliveryDate, gstRate, items } = req.body;
    if ((!supplierId && !supplierName) || !orderDate || !items || items.length === 0) {
      return res.status(400).json({ error: "supplier, orderDate and at least one item are required" });
    }

    const supplier = supplierId ? await Party.findOne({ _id: supplierId, partyType: "vendor" }) : null;
    if (supplierId && !supplier) return res.status(400).json({ error: "Selected vendor not found" });

    const itemsWithAmount = items.map((i) => {
      const itemGstRate = Number(i.gstRate || 0);
      if (!Number.isFinite(itemGstRate) || itemGstRate < 0 || itemGstRate > 100) throw new Error("GST rate must be between 0 and 100");
      const amount = i.qty * i.rate;
      return { ...i, gstRate: itemGstRate, amount, gstAmount: amount * itemGstRate / 100 };
    });
    const totalQty = itemsWithAmount.reduce((sum, i) => sum + i.qty, 0);
    const totalPrice = itemsWithAmount.reduce((sum, i) => sum + i.amount, 0);
    const gstAmount = itemsWithAmount.reduce((sum, i) => sum + i.gstAmount, 0);
    const poNumber = await nextNumber(PurchaseOrder, "poNumber", "PO");

    const po = await PurchaseOrder.create({
      poNumber,
      supplier: supplier?._id,
      supplierName: supplier?.name || supplierName,
      orderDate,
      paymentTerm,
      expectedDeliveryDate,
      items: itemsWithAmount,
      totalQty,
      totalPrice,
      gstRate: 0,
      gstAmount,
      grandTotal: totalPrice + gstAmount,
      createdBy: req.user.id,
    });

    return res.status(201).json({ purchaseOrder: po });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/purchase-orders/:id
router.put("/:id", requireAuth, requirePermission("po"), async (req, res) => {
  try {
    const { items } = req.body;
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: "Purchase order not found" });
    if (!["draft", "placed"].includes(po.status) && req.user.role !== "ADMIN") return res.status(400).json({ error: "Only draft or confirmed purchase orders can be edited" });
    if (!items || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" });
    }

    const itemsWithAmount = items.map((i) => {
      const itemGstRate = Number(i.gstRate || 0);
      if (!Number.isFinite(itemGstRate) || itemGstRate < 0 || itemGstRate > 100) throw new Error("GST rate must be between 0 and 100");
      const amount = Number(i.qty) * Number(i.rate);
      return { ...i, qty: Number(i.qty), rate: Number(i.rate), gstRate: itemGstRate, amount, gstAmount: amount * itemGstRate / 100 };
    });
    const totalQty = itemsWithAmount.reduce((sum, i) => sum + i.qty, 0);
    const totalPrice = itemsWithAmount.reduce((sum, i) => sum + i.amount, 0);
    const gstAmount = itemsWithAmount.reduce((sum, i) => sum + i.gstAmount, 0);
    Object.assign(po, {
      items: itemsWithAmount,
      totalQty,
      totalPrice,
      gstRate: 0,
      gstAmount,
      grandTotal: totalPrice + gstAmount,
    });
    await po.save();
    return res.json({ purchaseOrder: po });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/purchase-orders/:id
router.delete("/:id", requireAuth, requirePermission("po"), async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: "Purchase order not found" });
    if (!["draft", "placed"].includes(po.status) && req.user.role !== "ADMIN") return res.status(400).json({ error: "Only draft or placed purchase orders can be deleted" });
    await po.deleteOne();
    return res.json({ message: "Purchase order deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/purchase-orders/:id/duplicate
router.post("/:id/duplicate", requireAuth, requirePermission("po"), async (req, res) => {
  try {
    const source = await PurchaseOrder.findById(req.params.id);
    if (!source) return res.status(404).json({ error: "Purchase order not found" });

    const po = await PurchaseOrder.create({
      poNumber: await nextNumber(PurchaseOrder, "poNumber", "PO"),
      supplier: source.supplier,
      supplierName: source.supplierName,
      orderDate: source.orderDate,
      paymentTerm: source.paymentTerm,
      expectedDeliveryDate: source.expectedDeliveryDate,
      status: "draft",
      items: source.items.map((item) => item.toObject()),
      totalQty: source.totalQty,
      totalPrice: source.totalPrice,
      gstRate: source.gstRate,
      gstAmount: source.gstAmount,
      grandTotal: source.grandTotal,
      createdBy: req.user.id,
    });

    return res.status(201).json({ purchaseOrder: po });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/purchase-orders/:id/confirm
router.patch("/:id/confirm", requireAuth, requirePermission("po"), async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: "Purchase order not found" });
    if (po.status !== "draft") return res.status(400).json({ error: "Only draft purchase orders can be confirmed" });
    po.status = "placed";
    await po.save();
    return res.json({ purchaseOrder: po });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/purchase-orders
router.get("/", requireAuth, requirePermission("po"), async (req, res) => {
  try {
    const orders = await PurchaseOrder.find()
      .select("poNumber supplierName orderDate paymentTerm expectedDeliveryDate status totalQty totalPrice gstAmount grandTotal items")
      .sort({ createdAt: -1 });
    const receivedByPo = await receivedQuantitiesByPo(orders.map((order) => order._id));
    return res.json({ purchaseOrders: orders.map((order) => addPendingQuantities(order, receivedByPo[String(order._id)] || {})) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/purchase-orders/open/list
router.get("/open/list", requireAuth, requirePermission("po", "grn"), async (req, res) => {
  try {
    const orders = await PurchaseOrder.find({ status: { $in: ["placed", "partially_received"] } })
      .select("poNumber supplier supplierName orderDate items totalQty status")
      .populate("supplier")
      .sort({ createdAt: -1 });
    const receivedByPo = await receivedQuantitiesByPo(orders.map((order) => order._id));
    return res.json({ purchaseOrders: orders.map((order) => addPendingQuantities(order, receivedByPo[String(order._id)] || {})) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/purchase-orders/:id
router.get("/:id", requireAuth, requirePermission("po", "grn"), async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate("createdBy", "name").populate("supplier");
    if (!po) return res.status(404).json({ error: "Purchase order not found" });
    const receivedByPo = await receivedQuantitiesByPo([po._id]);
    const linkedGrns = await Grn.find({ purchaseOrder: po._id })
      .select("grnNumber createdAt createdBy")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });
    const latestGrn = linkedGrns[0];
    const purchaseOrder = addPendingQuantities(po, receivedByPo[String(po._id)] || {});
    purchaseOrder.linkedGrns = linkedGrns;
    purchaseOrder.lastUpdatedBy = latestGrn?.createdBy?.name || po.createdBy?.name || "-";
    purchaseOrder.lastUpdatedAt = latestGrn?.createdAt || po.updatedAt;
    return res.json({ purchaseOrder });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
