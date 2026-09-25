const express = require("express");
const crypto = require("crypto");
const multer = require("multer");
const XLSX = require("xlsx");
const { requireAuth } = require("../middleware/auth");
const PurchaseOrder = require("../models/PurchaseOrder");
const Grn = require("../models/Grn");
const BulkUpload = require("../models/BulkUpload");
const Party = require("../models/Party");
const Sku = require("../models/Sku");
const { nextNumber } = require("../utils/idGenerator");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const BULK_PO_COLUMNS = ["Vendor UID", "Supplier", "Order Date", "Payment Term", "Expected Delivery Date", "Product UID", "SKU", "Qty", "Rate", "GST Rate"];

function getCell(row, name) {
  const key = Object.keys(row).find((candidate) => candidate.trim().toLowerCase() === name.toLowerCase());
  return key === undefined ? "" : String(row[key]).trim();
}

function getRawCell(row, name) {
  const key = Object.keys(row).find((candidate) => candidate.trim().toLowerCase() === name.toLowerCase());
  return key === undefined ? "" : row[key];
}

function parseDate(value) {
  if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) value = Number(value);
  if (typeof value === "string") {
    const dayFirst = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dayFirst) return new Date(Date.UTC(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1])));
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

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

router.get("/bulk-sample", (req, res) => {
  const sample = [{
    "Vendor UID": "PASTE-VENDOR-UID-HERE",
    Supplier: "Apex Healthcare Pvt Ltd",
    "Order Date": "2026-09-25",
    "Payment Term": "Net 30",
    "Expected Delivery Date": "2026-10-10",
    "Product UID": "PASTE-PRODUCT-UID-HERE",
    SKU: "Paracetamol 500mg",
    Qty: 10,
    Rate: 20,
    "GST Rate": 5,
  }];
  const worksheet = XLSX.utils.json_to_sheet(sample, { header: BULK_PO_COLUMNS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Orders");
  const format = (req.query.format || "csv").toLowerCase();
  if (format === "xlsx" || format === "excel") {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=sample_purchase_orders.xlsx");
    return res.send(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=sample_purchase_orders.csv");
  return res.send(XLSX.utils.sheet_to_csv(worksheet));
});

router.post("/bulk-upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = firstSheet ? XLSX.utils.sheet_to_json(firstSheet, { defval: "" }) : [];
    if (!rows.length) return res.status(400).json({ error: "Uploaded file contains no rows" });

    const [vendors, skus] = await Promise.all([
      Party.find({ partyType: "vendor" }).select("name uid"),
      Sku.find().select("name uid"),
    ]);
    await Promise.all(vendors.filter((vendor) => !vendor.uid).map(async (vendor) => {
      vendor.uid = crypto.randomUUID();
      await vendor.save();
    }));
    const vendorsByUid = new Map(vendors.filter((vendor) => vendor.uid).map((vendor) => [vendor.uid.trim().toLowerCase(), vendor]));
    const vendorsByName = new Map(vendors.map((vendor) => [vendor.name.trim().toLowerCase(), vendor]));
    const skusByUid = new Map();
    const skusByName = new Map();
    skus.forEach((sku) => {
      skusByName.set(sku.name.trim().toLowerCase(), sku);
      if (sku.uid) skusByUid.set(sku.uid.trim().toLowerCase(), sku);
    });

    const groups = new Map();
    const errorDetails = [];
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const vendorUid = getCell(row, "Vendor UID");
      const supplierName = getCell(row, "Supplier");
      const productUid = getCell(row, "Product UID") || getCell(row, "SKU UID");
      const skuName = getCell(row, "SKU");
      const orderDate = parseDate(getRawCell(row, "Order Date"));
      const expectedDeliveryDateValue = getCell(row, "Expected Delivery Date");
      const expectedDeliveryDate = expectedDeliveryDateValue ? parseDate(getRawCell(row, "Expected Delivery Date")) : null;
      const qty = Number(getCell(row, "Qty"));
      const rate = Number(getCell(row, "Rate"));
      const gstRateValue = getCell(row, "GST Rate");
      const gstRate = gstRateValue === "" ? 0 : Number(gstRateValue);
      const supplierByUid = vendorsByUid.get(vendorUid.toLowerCase());
      const supplierByName = vendorsByName.get(supplierName.toLowerCase());
      const supplier = supplierByUid || supplierByName;
      const skuByUid = skusByUid.get(productUid.toLowerCase());
      const skuByName = skusByName.get(skuName.toLowerCase());
      const sku = skuByUid || skuByName;
      const rowErrors = [];

      if (!vendorUid && !supplierName) rowErrors.push("Vendor UID or Supplier name is required");
      else if (!supplier) rowErrors.push(vendorUid ? `Vendor UID not found: ${vendorUid}` : `Supplier not found: ${supplierName}`);
      if (supplierByUid && supplierByName && String(supplierByUid._id) !== String(supplierByName._id)) rowErrors.push("Supplier name does not match Vendor UID");
      if (!productUid && !skuName) rowErrors.push("Product UID or SKU name is required");
      else if (!sku) rowErrors.push(productUid ? `Product UID not found: ${productUid}` : `SKU not found: ${skuName}`);
      if (skuByUid && skuByName && String(skuByUid._id) !== String(skuByName._id)) rowErrors.push("SKU name does not match Product UID");
      if (!orderDate) rowErrors.push("Order Date must be a valid date");
      if (expectedDeliveryDateValue && !expectedDeliveryDate) rowErrors.push("Expected Delivery Date must be a valid date");
      if (!Number.isFinite(qty) || qty < 1) rowErrors.push("Qty must be at least 1");
      if (!Number.isFinite(rate) || rate < 0) rowErrors.push("Rate must be a non-negative number");
      if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) rowErrors.push("GST Rate must be between 0 and 100");

      if (rowErrors.length) {
        errorDetails.push({ rowNumber, data: row, errorList: rowErrors });
        return;
      }

      const groupKey = String(supplier._id);
      if (!groups.has(groupKey)) groups.set(groupKey, { supplier, supplierName: supplier.name, orderDate, paymentTerm: getCell(row, "Payment Term"), expectedDeliveryDate, items: [] });
      const group = groups.get(groupKey);
      group.items.push({ sku: sku._id, skuName: sku.name, qty, rate, gstRate });
    });

    if (errorDetails.length) {
      const uploadRecord = await BulkUpload.create({
        fileName: req.file.originalname,
        masterType: "purchase-order",
        status: "error",
        totalRecords: rows.length,
        successRecords: 0,
        errorRecords: errorDetails.length,
        errorDetails,
        createdBy: req.user.id,
      });
      const messages = errorDetails.slice(0, 8).map((detail) => `Row ${detail.rowNumber}: ${detail.errorList.join(", ")}`);
      return res.status(400).json({ error: `Validation failed. ${messages.join("; ")}`, bulkUploadId: uploadRecord._id });
    }

    const created = [];
    for (const group of groups.values()) {
      const items = group.items.map((item) => {
        const amount = item.qty * item.rate;
        return { ...item, amount, gstAmount: amount * item.gstRate / 100 };
      });
      const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
      const totalPrice = items.reduce((sum, item) => sum + item.amount, 0);
      const gstAmount = items.reduce((sum, item) => sum + item.gstAmount, 0);
      created.push(await PurchaseOrder.create({
        poNumber: await nextNumber(PurchaseOrder, "poNumber", "PO"),
        supplier: group.supplier._id,
        supplierName: group.supplierName,
        orderDate: group.orderDate,
        paymentTerm: group.paymentTerm,
        expectedDeliveryDate: group.expectedDeliveryDate,
        items,
        totalQty,
        totalPrice,
        gstRate: 0,
        gstAmount,
        grandTotal: totalPrice + gstAmount,
        createdBy: req.user.id,
      }));
    }
    await BulkUpload.create({
      fileName: req.file.originalname,
      masterType: "purchase-order",
      status: "done",
      totalRecords: rows.length,
      successRecords: rows.length,
      errorRecords: 0,
      errorDetails: [],
      createdBy: req.user.id,
    });
    return res.status(201).json({ message: `Successfully imported ${created.length} purchase orders.`, purchaseOrders: created });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/purchase-orders/:id - updates a draft or placed purchase order
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { items } = req.body;
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: "Purchase order not found" });
    if (!["draft", "placed"].includes(po.status)) return res.status(400).json({ error: "Only draft or confirmed purchase orders can be edited" });
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

// DELETE /api/purchase-orders/:id - deletes a draft or placed purchase order
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: "Purchase order not found" });
    if (!["draft", "placed"].includes(po.status)) return res.status(400).json({ error: "Only draft or placed purchase orders can be deleted" });
    await po.deleteOne();
    return res.json({ message: "Purchase order deleted" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/purchase-orders/:id/duplicate - creates a new draft from an existing PO
router.post("/:id/duplicate", requireAuth, async (req, res) => {
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

// PATCH /api/purchase-orders/:id/confirm - confirms a draft PO for receiving
router.patch("/:id/confirm", requireAuth, async (req, res) => {
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

// GET /api/purchase-orders - list (summary columns)
router.get("/", async (req, res) => {
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

// GET /api/purchase-orders/open/list - POs that still have something pending to receive
// (used by the GRN "create against a PO" picker)
router.get("/open/list", async (req, res) => {
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

// GET /api/purchase-orders/:id - full detail
router.get("/:id", async (req, res) => {
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
