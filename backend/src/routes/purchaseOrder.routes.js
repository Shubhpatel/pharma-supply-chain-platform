const express = require("express");
const { requireAuth } = require("../middleware/auth");
const PurchaseOrder = require("../models/PurchaseOrder");
const Grn = require("../models/Grn");
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

// POST /api/purchase-orders  { supplierName, orderDate, paymentTerm, expectedDeliveryDate, items: [{sku, skuName, qty, rate}] }
router.post("/", requireAuth, async (req, res) => {
  try {
    const { supplierName, orderDate, paymentTerm, expectedDeliveryDate, items } = req.body;
    if (!supplierName || !orderDate || !items || items.length === 0) {
      return res.status(400).json({ error: "supplierName, orderDate and at least one item are required" });
    }

    const itemsWithAmount = items.map((i) => ({ ...i, amount: i.qty * i.rate }));
    const totalQty = itemsWithAmount.reduce((sum, i) => sum + i.qty, 0);
    const totalPrice = itemsWithAmount.reduce((sum, i) => sum + i.amount, 0);
    const poNumber = await nextNumber(PurchaseOrder, "poNumber", "PO");

    const po = await PurchaseOrder.create({
      poNumber,
      supplierName,
      orderDate,
      paymentTerm,
      expectedDeliveryDate,
      items: itemsWithAmount,
      totalQty,
      totalPrice,
      createdBy: req.user.id,
    });

    return res.status(201).json({ purchaseOrder: po });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/purchase-orders - list (summary columns)
router.get("/", async (req, res) => {
  try {
    const orders = await PurchaseOrder.find()
      .select("poNumber supplierName orderDate paymentTerm expectedDeliveryDate status totalQty totalPrice items")
      .sort({ createdAt: -1 });
    const receivedByPo = await receivedQuantitiesByPo(orders.map((order) => order._id));
    return res.json({ purchaseOrders: orders.map((order) => addPendingQuantities(order, receivedByPo[String(order._id)] || {})) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/purchase-orders/open/list - POs that still have something pending to receive
// (used by the GRN "create against a PO" picker)
router.get("/open/list", async (req, res) => {
  try {
    const orders = await PurchaseOrder.find({ status: { $in: ["placed", "partially_received"] } })
      .select("poNumber supplierName orderDate items totalQty status")
      .sort({ createdAt: -1 });
    const receivedByPo = await receivedQuantitiesByPo(orders.map((order) => order._id));
    return res.json({ purchaseOrders: orders.map((order) => addPendingQuantities(order, receivedByPo[String(order._id)] || {})) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/purchase-orders/:id - full detail
router.get("/:id", async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate("createdBy", "name");
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
