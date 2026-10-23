const express = require("express");
const { requireAuth } = require("../middleware/auth");
const SaleInvoice = require("../models/SaleInvoice");
const PurchaseOrder = require("../models/PurchaseOrder");
const Grn = require("../models/Grn");
const Stock = require("../models/Stock");

const router = express.Router();

function getSafeAction(question) {
  const text = question.toLowerCase();
  if (text.includes("slow-moving") || text.includes("slow moving")) return "/reports?tab=slow-moving";
  if (text.includes("expired") || text.includes("expiry")) return "/reports?tab=near-expired";
  if (text.includes("inventory") || text.includes("stock")) return "/inventory";
  if (text.includes("sales report")) return "/reports?tab=sales";
  if (text.includes("purchase order") || text.includes("new po")) return "/purchase/new";
  if (text.includes("sales invoice") || text.includes("new invoice")) return "/sales/new";
  if (text.includes("grn") || text.includes("goods receipt")) return "/grn/new";
  return null;
}

function isPurchaseDraftRequest(question) {
  const text = question.toLowerCase();
  return (text.includes("purchase") || /\bpo\b/.test(text)) &&
    (text.includes("last month") || text.includes("average") || text.includes("avg") || text.includes("sales"));
}

function buildPurchaseDraft(sales) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const quantities = new Map();

  sales
    .filter((invoice) => {
      const date = new Date(invoice.saleDate);
      return date >= monthStart && date <= monthEnd;
    })
    .forEach((invoice) => {
      (invoice.items || []).forEach((item) => {
        const sku = String(item.sku || "");
        if (!sku) return;
        const current = quantities.get(sku) || { sku, skuName: item.skuName || "", qty: 0 };
        current.qty += Number(item.qty) || 0;
        quantities.set(sku, current);
      });
    });

  return Array.from(quantities.values()).map((item) => ({
    sku: item.sku,
    skuName: item.skuName,
    qty: String(Math.ceil(item.qty)),
    rate: "",
    gstRate: "0",
  }));
}

async function loadAssistantContext() {
  const [sales, purchaseOrders, grns, stock] = await Promise.all([
    SaleInvoice.find().sort({ saleDate: -1 }).limit(100).select("invoiceNumber customerName saleDate totalQty totalAmount grandTotal status items").lean(),
    PurchaseOrder.find().sort({ orderDate: -1 }).limit(50).select("poNumber supplierName orderDate totalQty grandTotal status items").lean(),
    Grn.find().sort({ grnDate: -1 }).limit(50).select("grnNumber supplierName grnDate totalQty grandTotal").lean(),
    Stock.find({ qty: { $gt: 0 } }).populate("sku", "code name category manufacturer uom").limit(200).lean(),
  ]);

  return {
    note: "Context is limited to recent records and positive stock. Use the application tables for the complete dataset.",
    sales,
    purchaseOrders,
    grns,
    stock: stock.filter((item) => item.sku).map((item) => ({
      sku: item.sku.name,
      code: item.sku.code,
      category: item.sku.category,
      batch: item.batch,
      expiryDate: item.expiryDate,
      qty: item.qty,
      rate: item.rate,
    })),
  };
}

router.post("/chat", requireAuth, async (req, res) => {
  const question = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 2000) : "";
  if (!question) return res.status(400).json({ error: "A message is required" });

  try {
    const context = await loadAssistantContext();
    const action = isPurchaseDraftRequest(question)
      ? { type: "prepare_purchase_order", items: buildPurchaseDraft(context.sales) }
      : null;
    if (action?.type === "prepare_purchase_order" && action.items.length === 0) {
      return res.json({
        reply: "I could not find sales in the previous calendar month, so I did not create a blank purchase-order draft.",
        source: "database",
      });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        reply: action ? "I prepared a purchase-order draft from last month’s sales. Review the supplier, rates, and quantities before saving." : "AI chat is not configured. I can still open the relevant platform area for you.",
        actionPath: getSafeAction(question),
        action,
        source: "fallback",
      });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const prompt = [
      "You are the Pharma Buddy operations assistant.",
      "Answer using only the database context supplied below. Never invent quantities, prices, dates, customers, suppliers, or stock.",
      "If the context is limited, say so. Do not claim to have created or changed a transaction.",
      "Give a direct answer with useful numbers and short bullet points where appropriate.",
      `User question: ${question}`,
      `Database context: ${JSON.stringify(context)}`,
    ].join("\n\n");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 900 } }),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }
    const result = await response.json().catch(() => ({}));
    const reply = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!response.ok || !reply) {
      console.error("Assistant Gemini request failed:", result.error?.message || response.status);
      return res.json({
        reply: "I could not reach the AI service. I loaded the relevant database context, but please use the report screens for exact complete results.",
        actionPath: getSafeAction(question),
        action,
        source: "fallback",
      });
    }
    return res.json({ reply, actionPath: getSafeAction(question), action, source: "gemini" });
  } catch (err) {
    console.error("Assistant database/AI error:", err.message);
    return res.status(500).json({ error: "The assistant could not access platform data right now" });
  }
});

module.exports = router;
