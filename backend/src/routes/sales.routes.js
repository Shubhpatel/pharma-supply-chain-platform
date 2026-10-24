const express = require("express");
const { requireAuth, requirePermission } = require("../middleware/auth");
const SaleInvoice = require("../models/SaleInvoice");
const CreditNote = require("../models/CreditNote");
const Stock = require("../models/Stock");
const Party = require("../models/Party");
const { nextNumber } = require("../utils/idGenerator");

const router = express.Router();

// POST /api/sales
router.post("/", requireAuth, requirePermission("invoice"), async (req, res, next) => {
  try {
    const { customerId, customerName, saleDate, gstRate, items } = req.body;
    if ((!customerId && !customerName) || !saleDate || !items || items.length === 0) {
      return res.status(400).json({ error: "customer, saleDate and at least one item are required" });
    }

    const customer = customerId ? await Party.findOne({ _id: customerId, partyType: "customer" }) : null;
    if (customerId && !customer) return res.status(400).json({ error: "Selected customer not found" });

    const itemsWithAmount = items.map((i) => ({
      ...i,
      batch: String(i.batch || "").trim(),
      qty: Number(i.qty),
      rate: Number(i.rate),
      mrp: Number(i.mrp),
      amount: Number(i.qty) * Number(i.rate),
      gstRate: Number(i.gstRate || 0),
    }));
    for (const item of itemsWithAmount) {
      if (!Number.isFinite(item.gstRate) || item.gstRate < 0 || item.gstRate > 100) {
        return res.status(400).json({ error: "GST rate must be between 0 and 100" });
      }
      item.gstAmount = item.amount * item.gstRate / 100;
    }

    const totalQty = itemsWithAmount.reduce((sum, i) => sum + i.qty, 0);
    const totalAmount = itemsWithAmount.reduce((sum, i) => sum + i.amount, 0);
    const gstAmount = itemsWithAmount.reduce((sum, i) => sum + i.gstAmount, 0);
    const invoiceNumber = await nextNumber(SaleInvoice, "invoiceNumber", "INV");

    const invoice = await SaleInvoice.create({
      invoiceNumber,
      customer: customer?._id,
      customerName: customer?.name || customerName,
      saleDate,
      items: itemsWithAmount,
      totalQty,
      totalAmount,
      gstRate: 0,
      gstAmount,
      grandTotal: totalAmount + gstAmount,
      createdBy: req.user.id,
    });

    return res.status(201).json({ invoice });
  } catch (err) {
    next(err);
  }
});

// PUT /api/sales/:id
router.put("/:id", requireAuth, requirePermission("invoice"), async (req, res, next) => {
  try {
    const { customerId, customerName, saleDate, items } = req.body;
    const invoice = await SaleInvoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.status !== "draft" && req.user.role !== "ADMIN") return res.status(400).json({ error: "Only draft invoices can be edited" });
    if ((!customerId && !customerName) || !saleDate || !items || items.length === 0) {
      return res.status(400).json({ error: "customer, saleDate and at least one item are required" });
    }

    const customer = customerId ? await Party.findOne({ _id: customerId, partyType: "customer" }) : null;
    if (customerId && !customer) return res.status(400).json({ error: "Selected customer not found" });
    const itemsWithAmount = items.map((i) => {
      const item = { ...i, batch: String(i.batch || "").trim(), qty: Number(i.qty), rate: Number(i.rate), mrp: Number(i.mrp), amount: Number(i.qty) * Number(i.rate), gstRate: Number(i.gstRate || 0) };
      if (!Number.isFinite(item.gstRate) || item.gstRate < 0 || item.gstRate > 100) throw new Error("GST rate must be between 0 and 100");
      item.gstAmount = item.amount * item.gstRate / 100;
      return item;
    });
    const totalQty = itemsWithAmount.reduce((sum, i) => sum + i.qty, 0);
    const totalAmount = itemsWithAmount.reduce((sum, i) => sum + i.amount, 0);
    const gstAmount = itemsWithAmount.reduce((sum, i) => sum + i.gstAmount, 0);
    Object.assign(invoice, {
      customer: customer?._id,
      customerName: customer?.name || customerName,
      saleDate,
      items: itemsWithAmount,
      totalQty,
      totalAmount,
      gstRate: 0,
      gstAmount,
      grandTotal: totalAmount + gstAmount,
    });
    await invoice.save();
    return res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sales/:id
router.delete("/:id", requireAuth, requirePermission("invoice"), async (req, res, next) => {
  try {
    const invoice = await SaleInvoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.status !== "draft" && req.user.role !== "ADMIN") return res.status(400).json({ error: "Only draft invoices can be deleted" });
    await invoice.deleteOne();
    return res.json({ message: "Invoice deleted" });
  } catch (err) {
    next(err);
  }
});

// POST /api/sales/:id/duplicate
router.post("/:id/duplicate", requireAuth, requirePermission("invoice"), async (req, res, next) => {
  try {
    const source = await SaleInvoice.findById(req.params.id);
    if (!source) return res.status(404).json({ error: "Invoice not found" });

    const invoice = await SaleInvoice.create({
      invoiceNumber: await nextNumber(SaleInvoice, "invoiceNumber", "INV"),
      customer: source.customer,
      customerName: source.customerName,
      saleDate: source.saleDate,
      items: source.items.map((item) => item.toObject()),
      totalQty: source.totalQty,
      totalAmount: source.totalAmount,
      gstRate: source.gstRate,
      gstAmount: source.gstAmount,
      grandTotal: source.grandTotal,
      status: "draft",
      createdBy: req.user.id,
    });

    return res.status(201).json({ invoice });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/sales/:id/confirm
router.patch("/:id/confirm", requireAuth, requirePermission("invoice"), async (req, res, next) => {
  try {
    const invoice = await SaleInvoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.status !== "draft") return res.status(400).json({ error: "Only draft invoices can be confirmed" });

    for (const item of invoice.items) {
      if (!item.batch || !item.expiryDate || Number.isNaN(Number(item.mrp))) {
        return res.status(400).json({ error: `Batch, expiry date and MRP are required for ${item.skuName}` });
      }
      const stockRecords = await Stock.find({ sku: item.sku, batch: item.batch });
      const matchingLotRecords = stockRecords.filter((stock) =>
        stock.expiryDate.toISOString().slice(0, 10) === new Date(item.expiryDate).toISOString().slice(0, 10)
        && Number(stock.mrp) === Number(item.mrp)
      );
      const available = matchingLotRecords.reduce((sum, stock) => sum + stock.qty, 0);
      if (available < item.qty) {
        return res.status(400).json({ error: `Not enough stock for ${item.skuName} (${item.batch}): have ${available}, need ${item.qty}` });
      }
    }

    for (const item of invoice.items) {
      const matchingStocks = await Stock.find({
        sku: item.sku,
        batch: item.batch,
        expiryDate: new Date(item.expiryDate),
        mrp: item.mrp,
      }).sort({ expiryDate: 1, rate: 1, mrp: 1 });
      let remaining = item.qty;
      for (const stock of matchingStocks) {
        if (remaining <= 0) break;
        const consumed = Math.min(remaining, stock.qty);
        await Stock.findByIdAndUpdate(stock._id, { $inc: { qty: -consumed } });
        remaining -= consumed;
      }
    }

    invoice.status = "confirmed";
    await invoice.save();
    return res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

// GET /api/sales
router.get("/", requireAuth, requirePermission("invoice", "sr"), async (req, res, next) => {
  try {
    // Performance: .lean() returns plain JS objects, avoiding Mongoose document hydration overhead
    const invoices = await SaleInvoice.find()
      .select("invoiceNumber customerName saleDate totalQty totalAmount gstRate gstAmount grandTotal status")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ invoices });
  } catch (err) {
    next(err);
  }
});

// GET /api/sales/:id
router.get("/:id", requireAuth, requirePermission("invoice", "sr"), async (req, res, next) => {
  try {
    // Performance: .lean() bypasses Mongoose document hydration for read-only view
    const invoice = await SaleInvoice.findById(req.params.id)
      .populate("createdBy", "name")
      .populate("customer")
      .lean();
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const linkedSalesReturns = await CreditNote.find({ saleInvoice: invoice._id })
      .select("creditNoteNumber status returnDate createdAt")
      .sort({ createdAt: -1 })
      .lean();

    invoice.linkedSalesReturns = linkedSalesReturns;
    return res.json({ invoice });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
