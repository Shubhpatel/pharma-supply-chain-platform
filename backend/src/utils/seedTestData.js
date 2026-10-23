// Run with: `npm run seed:test` (from backend/).
// Adds a small, repeatable dataset for exercising the application manually.
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const User = require("../models/User");
const Sku = require("../models/Sku");
const Party = require("../models/Party");
const PurchaseOrder = require("../models/PurchaseOrder");
const Grn = require("../models/Grn");
const Stock = require("../models/Stock");
const SaleInvoice = require("../models/SaleInvoice");
const DebitNote = require("../models/DebitNote");
const CreditNote = require("../models/CreditNote");

const TEST_PREFIX = "Test data -";
const TEST_EMAIL = (process.env.TEST_SEED_EMAIL || "test@pharma.local").toLowerCase();
const TEST_PASSWORD = process.env.TEST_SEED_PASSWORD || "test123";

const today = new Date();
today.setHours(0, 0, 0, 0);
const expiryDate = new Date(today);
expiryDate.setFullYear(expiryDate.getFullYear() + 2);

async function ensureTestUser() {
  let user = await User.findOne({ email: TEST_EMAIL });
  if (!user) {
    user = await User.create({
      name: "Test User",
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
    });
    console.log(`Created test user: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
  } else {
    console.log(`Test user already exists: ${TEST_EMAIL}`);
  }
  return user;
}

async function ensureSkus() {
  const skus = await Sku.find({ enabled: true }).sort({ name: 1 }).limit(3);
  if (skus.length < 2) {
    throw new Error("At least 2 enabled SKUs are required in Masters before running npm run seed:test");
  }
  return skus;
}

async function getExistingParty(partyType) {
  const party = await Party.findOne({ partyType, enabled: true }).sort({ name: 1 });
  if (!party) {
    throw new Error(`An enabled ${partyType} is required in Masters before running npm run seed:test`);
  }
  return party;
}

async function ensurePurchaseOrder(userId, vendor, skus) {
  const poNumber = "TEST-PO-000001";
  let purchaseOrder = await PurchaseOrder.findOne({ poNumber });
  if (purchaseOrder) return purchaseOrder;

  const items = skus.map((sku, index) => {
    const qty = 100 + index * 50;
    const rate = Math.round(sku.mrp * 0.6 * 100) / 100;
    const amount = qty * rate;
    return { sku: sku._id, skuName: sku.name, qty, rate, amount, gstRate: 12, gstAmount: amount * 0.12 };
  });
  const totalPrice = items.reduce((sum, item) => sum + item.amount, 0);
  const gstAmount = items.reduce((sum, item) => sum + item.gstAmount, 0);

  return PurchaseOrder.create({
    poNumber,
    supplier: vendor._id,
    supplierName: vendor.name,
    orderDate: today,
    paymentTerm: "Net 30",
    expectedDeliveryDate: expiryDate,
    status: "placed",
    items,
    totalQty: items.reduce((sum, item) => sum + item.qty, 0),
    totalPrice,
    gstRate: 12,
    gstAmount,
    grandTotal: totalPrice + gstAmount,
    createdBy: userId,
  });
}

async function ensureStock(skus) {
  for (const [index, sku] of skus.entries()) {
    const stockData = {
      sku: sku._id,
      batch: `TEST-BATCH-${index + 1}`,
      expiryDate,
      mrp: sku.mrp,
      rate: Math.round(sku.mrp * 0.6 * 100) / 100,
      qty: 80 + index * 30,
    };
    await Stock.updateOne(
      { sku: stockData.sku, batch: stockData.batch, expiryDate: stockData.expiryDate, mrp: stockData.mrp, rate: stockData.rate },
      { $setOnInsert: stockData },
      { upsert: true }
    );
  }
}

async function ensureDraftGrn(userId, purchaseOrder, skus, vendor) {
  const grnNumber = "TEST-GRN-000001";
  if (await Grn.exists({ grnNumber })) return;

  const items = skus.map((sku, index) => {
    const qtyReceived = 20 + index * 10;
    const rate = Math.round(sku.mrp * 0.6 * 100) / 100;
    const amount = qtyReceived * rate;
    return {
      sku: sku._id,
      skuName: sku.name,
      qtyOrdered: 100 + index * 50,
      qtyReceived,
      batch: `TEST-BATCH-${index + 1}`,
      expiryDate,
      mrp: sku.mrp,
      rate,
      amount,
      gstRate: 12,
      gstAmount: amount * 0.12,
    };
  });
  const totalValue = items.reduce((sum, item) => sum + item.amount, 0);
  const gstAmount = items.reduce((sum, item) => sum + item.gstAmount, 0);

  await Grn.create({
    grnNumber,
    purchaseOrder: purchaseOrder._id,
    supplier: vendor._id,
    poNumber: purchaseOrder.poNumber,
    supplierName: vendor.name,
    grnDate: today,
    purchaseInvoiceNumber: "TEST-PI-000001",
    purchaseInvoiceDate: today,
    items,
    totalQty: items.reduce((sum, item) => sum + item.qtyReceived, 0),
    totalValue,
    gstRate: 0,
    gstAmount,
    grandTotal: totalValue + gstAmount,
    status: "draft",
    createdBy: userId,
  });
}

async function ensureDraftSale(userId, customer, skus) {
  const invoiceNumber = "TEST-INV-000001";
  if (await SaleInvoice.exists({ invoiceNumber })) return;

  const items = skus.slice(0, 2).map((sku, index) => {
    const qty = 2 + index;
    const rate = Math.round(sku.mrp * 0.9 * 100) / 100;
    const amount = qty * rate;
    return {
      sku: sku._id,
      skuName: sku.name,
      batch: `TEST-BATCH-${index + 1}`,
      expiryDate,
      mrp: sku.mrp,
      qty,
      rate,
      amount,
      gstRate: 12,
      gstAmount: amount * 0.12,
    };
  });
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const gstAmount = items.reduce((sum, item) => sum + item.gstAmount, 0);

  await SaleInvoice.create({
    invoiceNumber,
    customer: customer._id,
    customerName: customer.name,
    saleDate: today,
    items,
    totalQty: items.reduce((sum, item) => sum + item.qty, 0),
    totalAmount,
    gstRate: 0,
    gstAmount,
    grandTotal: totalAmount + gstAmount,
    status: "draft",
    createdBy: userId,
  });
}

function dateDaysAgo(days) {
  const date = new Date(today);
  date.setDate(date.getDate() - days);
  return date;
}

function makeItems(skus, index, type) {
  return skus.map((sku, skuIndex) => {
    const qty = type === "grn" ? 50 + index * 10 + skuIndex * 5 : 100 + index * 20 + skuIndex * 10;
    const rate = Math.round(sku.mrp * (type === "sale" ? 0.9 : 0.6) * 100) / 100;
    const amount = qty * rate;
    return {
      sku: sku._id,
      skuName: sku.name,
      qty,
      qtyOrdered: type === "grn" ? 100 + index * 20 + skuIndex * 10 : undefined,
      qtyReceived: type === "grn" ? qty : undefined,
      batch: `TEST-BATCH-${String(index + 1).padStart(2, "0")}-${skuIndex + 1}`,
      expiryDate,
      mrp: sku.mrp,
      rate,
      amount,
      gstRate: 12,
      gstAmount: amount * 0.12,
    };
  });
}

async function ensureBulkTransactions(userId, vendor, customer, skus) {
  const generatedGrns = [];
  const generatedInvoices = [];
  const batchCount = 6;

  for (let index = 0; index < batchCount; index += 1) {
    const date = dateDaysAgo((index + 1) * 30);
    const poNumber = `TEST-PO-${String(index + 2).padStart(6, "0")}`;
    let purchaseOrder = await PurchaseOrder.findOne({ poNumber });

    if (!purchaseOrder) {
      const items = makeItems(skus, index, "po");
      const totalPrice = items.reduce((sum, item) => sum + item.amount, 0);
      const gstAmount = items.reduce((sum, item) => sum + item.gstAmount, 0);
      purchaseOrder = await PurchaseOrder.create({
        poNumber,
        supplier: vendor._id,
        supplierName: vendor.name,
        orderDate: date,
        paymentTerm: index % 2 ? "Advance" : "Net 30",
        expectedDeliveryDate: new Date(date.getTime() + 7 * 86400000),
        status: "partially_received",
        items: items.map(({ qty, ...item }) => ({ ...item, qty })),
        totalQty: items.reduce((sum, item) => sum + item.qty, 0),
        totalPrice,
        gstRate: 12,
        gstAmount,
        grandTotal: totalPrice + gstAmount,
        createdBy: userId,
      });
    }

    const grnNumber = `TEST-GRN-${String(index + 2).padStart(6, "0")}`;
    let grn = await Grn.findOne({ grnNumber });
    if (!grn) {
      const items = makeItems(skus, index, "grn");
      const totalValue = items.reduce((sum, item) => sum + item.amount, 0);
      const gstAmount = items.reduce((sum, item) => sum + item.gstAmount, 0);
      grn = await Grn.create({
        grnNumber,
        purchaseOrder: purchaseOrder._id,
        supplier: vendor._id,
        poNumber: purchaseOrder.poNumber,
        supplierName: vendor.name,
        grnDate: date,
        purchaseInvoiceNumber: `TEST-PI-${String(index + 2).padStart(6, "0")}`,
        purchaseInvoiceDate: date,
        items: items.map(({ qty, ...item }) => ({ ...item, qtyReceived: qty })),
        totalQty: items.reduce((sum, item) => sum + item.qty, 0),
        totalValue,
        gstRate: 0,
        gstAmount,
        grandTotal: totalValue + gstAmount,
        status: "confirmed",
        createdBy: userId,
      });
    }
    generatedGrns.push(grn);

    const stockItems = makeItems(skus, index, "grn");
    for (const item of stockItems) {
      const saleQty = index < 4 ? 2 + index : 0;
      const returnQty = index === 0 ? 1 : 0;
      const debitQty = index === 1 ? 1 : 0;
      await Stock.updateOne(
        { sku: item.sku, batch: item.batch, expiryDate: item.expiryDate, mrp: item.mrp, rate: item.rate },
        { $setOnInsert: { sku: item.sku, batch: item.batch, expiryDate: item.expiryDate, mrp: item.mrp, rate: item.rate, qty: item.qty - saleQty + returnQty - debitQty } },
        { upsert: true }
      );
    }

    const invoiceNumber = `TEST-INV-${String(index + 2).padStart(6, "0")}`;
    let invoice = await SaleInvoice.findOne({ invoiceNumber });
    if (!invoice && index < 4) {
      const items = makeItems(skus, index, "sale").slice(0, 2).map((item) => ({ ...item, qty: 2 + index, amount: (2 + index) * item.rate, gstAmount: (2 + index) * item.rate * 0.12 }));
      const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
      const gstAmount = items.reduce((sum, item) => sum + item.gstAmount, 0);
      invoice = await SaleInvoice.create({
        invoiceNumber,
        customer: customer._id,
        customerName: customer.name,
        saleDate: date,
        items,
        totalQty: items.reduce((sum, item) => sum + item.qty, 0),
        totalAmount,
        gstRate: 0,
        gstAmount,
        grandTotal: totalAmount + gstAmount,
        status: "confirmed",
        createdBy: userId,
      });
    }
    if (invoice) generatedInvoices.push(invoice);
  }

  if (generatedInvoices[0] && !(await CreditNote.exists({ creditNoteNumber: "TEST-CN-000001" }))) {
    const source = generatedInvoices[0];
    const item = source.items[0].toObject();
    item.qty = 1;
    item.amount = item.rate;
    item.gstAmount = item.amount * item.gstRate / 100;
    await CreditNote.create({
      creditNoteNumber: "TEST-CN-000001",
      saleInvoice: source._id,
      invoiceNumber: source.invoiceNumber,
      customer: customer._id,
      customerName: customer.name,
      returnDate: dateDaysAgo(10),
      reason: "Test customer return",
      items: [item],
      totalQty: 1,
      totalAmount: item.amount,
      gstAmount: item.gstAmount,
      grandTotal: item.amount + item.gstAmount,
      status: "confirmed",
      createdBy: userId,
    });
  }

  if (generatedGrns[1] && !(await DebitNote.exists({ debitNoteNumber: "TEST-DN-000001" }))) {
    const source = generatedGrns[1];
    const item = source.items[0].toObject();
    item.qty = 1;
    item.amount = item.rate;
    item.gstAmount = item.amount * item.gstRate / 100;
    await DebitNote.create({
      debitNoteNumber: "TEST-DN-000001",
      grn: source._id,
      grnNumber: source.grnNumber,
      supplier: vendor._id,
      supplierName: vendor.name,
      returnDate: dateDaysAgo(20),
      reason: "Test supplier return",
      items: [item],
      totalQty: 1,
      totalAmount: item.amount,
      gstAmount: item.gstAmount,
      grandTotal: item.amount + item.gstAmount,
      status: "confirmed",
      createdBy: userId,
    });
  }
}

async function seedTestData() {
  await connectDB();
  try {
    const user = await ensureTestUser();
    const skus = await ensureSkus();
    const vendor = await getExistingParty("vendor");
    const customer = await getExistingParty("customer");
    const purchaseOrder = await ensurePurchaseOrder(user._id, vendor, skus);

    await ensureStock(skus);
    await ensureDraftGrn(user._id, purchaseOrder, skus, vendor);
    await ensureDraftSale(user._id, customer, skus);
    await ensureBulkTransactions(user._id, vendor, customer, skus);

    console.log("Test data is ready.");
    console.log(`Login: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
    console.log("Created records use TEST- identifiers and can be safely used in manual flows.");
  } finally {
    await mongoose.connection.close();
  }
}

seedTestData().catch((err) => {
  console.error("Test data seed failed:", err.message);
  process.exitCode = 1;
});
