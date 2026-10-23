const Stock = require("../models/Stock");
const SaleInvoice = require("../models/SaleInvoice");
const PurchaseOrder = require("../models/PurchaseOrder");
const Grn = require("../models/Grn");
const Sku = require("../models/Sku");
const Party = require("../models/Party");
const DebitNote = require("../models/DebitNote");
const CreditNote = require("../models/CreditNote");

// Sanitizes data before injecting into model prompts to prevent prompt injection attacks
function sanitizePromptText(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/[\r\n]+/g, " ")
    .replace(/`/g, "'")
    .slice(0, 1000);
}

// Controlled query helper to fetch database context safely and efficiently
async function loadControlledDatabaseContext() {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    skus,
    vendors,
    customers,
    stocks,
    nearExpiryStocks,
    expiredStocks,
    recentSales,
    recentPurchaseOrders,
    recentGrns,
    recentDebitNotes,
    recentCreditNotes,
  ] = await Promise.all([
    Sku.find({ enabled: true }).select("code name category uom minReorderLevel mrp").limit(100).lean(),
    Party.find({ partyType: "vendor" }).select("name contactPerson phone email").limit(50).lean(),
    Party.find({ partyType: "customer" }).select("name contactPerson phone email").limit(50).lean(),
    Stock.find({ qty: { $gt: 0 } }).populate("sku", "code name category minReorderLevel").limit(150).lean(),
    Stock.find({ qty: { $gt: 0 }, expiryDate: { $gte: now, $lte: thirtyDaysFromNow } }).populate("sku", "code name").limit(50).lean(),
    Stock.find({ qty: { $gt: 0 }, expiryDate: { $lt: now } }).populate("sku", "code name").limit(50).lean(),
    SaleInvoice.find().sort({ saleDate: -1 }).limit(30).select("invoiceNumber customerName saleDate totalQty grandTotal status items").lean(),
    PurchaseOrder.find().sort({ orderDate: -1 }).limit(30).select("poNumber supplierName orderDate totalQty grandTotal status items").lean(),
    Grn.find().sort({ grnDate: -1 }).limit(30).select("grnNumber supplierName grnDate totalQty grandTotal").lean(),
    DebitNote.find().sort({ returnDate: -1 }).limit(20).select("debitNoteNumber supplierName returnDate grandTotal status").lean(),
    CreditNote.find().sort({ returnDate: -1 }).limit(20).select("creditNoteNumber customerName returnDate grandTotal status").lean(),
  ]);

  // Consolidate low-stock SKUs
  const stockBySku = new Map();
  stocks.forEach((st) => {
    if (!st.sku) return;
    const skuId = String(st.sku._id);
    const existing = stockBySku.get(skuId) || { sku: st.sku, totalQty: 0 };
    existing.totalQty += st.qty;
    stockBySku.set(skuId, existing);
  });

  const lowStockItems = Array.from(stockBySku.values())
    .filter((item) => item.sku.minReorderLevel > 0 && item.totalQty <= item.sku.minReorderLevel)
    .map((item) => ({
      skuCode: item.sku.code,
      skuName: item.sku.name,
      currentQty: item.totalQty,
      reorderLevel: item.sku.minReorderLevel,
    }));

  return {
    summaryNote: "Database context is filtered, capped, and read-only.",
    skus: skus.map((s) => ({ id: s._id, code: s.code, name: s.name, category: s.category, mrp: s.mrp })),
    vendors: vendors.map((v) => ({ id: v._id, name: v.name })),
    customers: customers.map((c) => ({ id: c._id, name: c.name })),
    stockOnHand: Array.from(stockBySku.values()).map((s) => ({
      code: s.sku.code,
      name: s.sku.name,
      totalQty: s.totalQty,
    })),
    lowStockItems,
    nearExpiryCount: nearExpiryStocks.length,
    nearExpiry: nearExpiryStocks.map((st) => ({
      skuName: st.sku?.name || "Unknown",
      batch: st.batch,
      expiryDate: st.expiryDate?.toISOString().slice(0, 10),
      qty: st.qty,
    })),
    expiredCount: expiredStocks.length,
    expired: expiredStocks.map((st) => ({
      skuName: st.sku?.name || "Unknown",
      batch: st.batch,
      expiryDate: st.expiryDate?.toISOString().slice(0, 10),
      qty: st.qty,
    })),
    recentSalesSummary: recentSales.map((s) => ({
      invoiceNumber: s.invoiceNumber,
      customerName: s.customerName,
      saleDate: s.saleDate?.toISOString().slice(0, 10),
      grandTotal: s.grandTotal,
      status: s.status,
    })),
    recentPurchaseOrders: recentPurchaseOrders.map((p) => ({
      poNumber: p.poNumber,
      supplierName: p.supplierName,
      orderDate: p.orderDate?.toISOString().slice(0, 10),
      grandTotal: p.grandTotal,
      status: p.status,
    })),
    unpaidOrPendingCount: recentSales.filter((s) => s.status === "draft").length + recentPurchaseOrders.filter((p) => p.status === "draft").length,
  };
}

// Intent Classifier based on text analysis
function classifyIntent(question) {
  const text = question.toLowerCase();

  if (text.includes("approve draft") || text.includes("approve action")) return "approve_draft";
  if (text.includes("reject draft") || text.includes("reject action")) return "reject_draft";
  if (text.includes("execute draft") || text.includes("execute action")) return "execute_draft";
  if (text.includes("update draft") || text.includes("change draft")) return "update_draft";

  if (
    text.includes("prepare purchase order") ||
    text.includes("create purchase order") ||
    text.includes("prepare po") ||
    text.includes("create po") ||
    text.includes("need replenishment") ||
    text.includes("replenish stock")
  ) {
    return "create_draft";
  }

  if (
    text.includes("prepare sales invoice") ||
    text.includes("create sales invoice") ||
    text.includes("create invoice") ||
    text.includes("prepare invoice")
  ) {
    return "create_draft";
  }

  if (
    text.includes("show low-stock") ||
    text.includes("low stock") ||
    text.includes("near expiry") ||
    text.includes("expired") ||
    text.includes("slow-moving") ||
    text.includes("unpaid") ||
    text.includes("pending") ||
    text.includes("analyze sales") ||
    text.includes("which products") ||
    text.includes("how many") ||
    text.includes("what is") ||
    text.includes("show") ||
    text.includes("list")
  ) {
    return "database_question";
  }

  if (text.includes("go to") || text.includes("open page") || text.includes("navigate")) {
    return "navigation";
  }

  return "database_question";
}

// Strict Payload Validators for Action Drafts
function validateActionPayload(actionType, payload) {
  const warnings = [];
  const errors = [];

  if (!payload || typeof payload !== "object") {
    return { isValid: false, errors: ["Payload must be an object"], warnings };
  }

  switch (actionType) {
    case "create_purchase_order": {
      if (!payload.supplierId && !payload.supplierName) {
        errors.push("Supplier (vendor) is required");
      }
      if (!payload.orderDate) {
        errors.push("Order date is required");
      }
      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        errors.push("At least one item is required in purchase order");
      } else {
        payload.items.forEach((item, idx) => {
          if (!item.sku) errors.push(`Item #${idx + 1}: SKU ID is required`);
          if (Number(item.qty) <= 0 || Number.isNaN(Number(item.qty))) warnings.push(`Item #${idx + 1}: Quantity should be greater than 0`);
          if (Number(item.rate) < 0 || Number.isNaN(Number(item.rate))) warnings.push(`Item #${idx + 1}: Rate should be non-negative`);
        });
      }
      break;
    }

    case "create_sales_invoice": {
      if (!payload.customerId && !payload.customerName) {
        errors.push("Customer is required");
      }
      if (!payload.saleDate) {
        errors.push("Sale date is required");
      }
      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        errors.push("At least one item is required in sales invoice");
      } else {
        payload.items.forEach((item, idx) => {
          if (!item.sku) errors.push(`Item #${idx + 1}: SKU ID is required`);
          if (!item.batch) warnings.push(`Item #${idx + 1}: Batch number is missing`);
          if (!item.expiryDate) warnings.push(`Item #${idx + 1}: Expiry date is missing`);
          if (Number(item.qty) <= 0 || Number.isNaN(Number(item.qty))) warnings.push(`Item #${idx + 1}: Quantity should be greater than 0`);
        });
      }
      break;
    }

    case "create_grn": {
      if (!payload.purchaseOrderId) errors.push("Purchase order ID is required");
      if (!payload.grnDate) errors.push("GRN date is required");
      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        errors.push("At least one item is required");
      }
      break;
    }

    case "create_debit_note": {
      if (!payload.supplierId && !payload.supplierName) errors.push("Supplier is required");
      if (!payload.returnDate) errors.push("Return date is required");
      if (!Array.isArray(payload.items) || payload.items.length === 0) errors.push("At least one item is required");
      break;
    }

    case "create_credit_note": {
      if (!payload.customerId && !payload.customerName) errors.push("Customer is required");
      if (!payload.returnDate) errors.push("Return date is required");
      if (!Array.isArray(payload.items) || payload.items.length === 0) errors.push("At least one item is required");
      break;
    }

    case "update_sku":
    case "toggle_sku":
    case "delete_sku": {
      if (!payload.skuId) errors.push("SKU ID is required");
      break;
    }

    default:
      errors.push(`Unsupported action type: ${actionType}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = {
  sanitizePromptText,
  loadControlledDatabaseContext,
  classifyIntent,
  validateActionPayload,
};
