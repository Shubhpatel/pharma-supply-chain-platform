const express = require("express");
const { requireAuth, requirePermission } = require("../middleware/auth");
const SaleInvoice = require("../models/SaleInvoice");
const Grn = require("../models/Grn");
const PurchaseOrder = require("../models/PurchaseOrder");
const Stock = require("../models/Stock");
const Sku = require("../models/Sku");

const router = express.Router();

function createFallbackReport(reportType, summary, data) {
  const metrics = Object.entries(summary || {})
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
  const firstRecord = data[0] || {};
  const notableField = firstRecord.skuName || firstRecord.name || firstRecord.invoiceNumber || firstRecord.poNumber;

  return [
    "Executive summary",
    `The ${reportType} contains ${data.length} record(s). ${metrics || "No aggregate metrics were provided."}`,
    "",
    "Key findings",
    `- Review the ${data.length} record(s) included in this report before making operational decisions.`,
    notableField ? `- The first listed record is ${notableField}.` : "- No individual record details were available.",
    "",
    "Recommended actions",
    "- Validate the report filters and prioritize exceptions with the highest quantity or value.",
    "- Re-run AI insights later if a natural-language analysis is required.",
  ].join("\n");
}

// Generate a concise operational summary without exposing the provider key to the browser.
router.post("/ai-summary", requireAuth, async (req, res, next) => {
  try {
    const { reportType, summary, data } = req.body || {};
    if (!reportType || !Array.isArray(data)) {
      return res.status(400).json({ error: "Report type and report data are required" });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "AI reporting is not configured. Add GEMINI_API_KEY to the backend environment." });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const reportPayload = {
      reportType: String(reportType).slice(0, 80),
      summary: summary && typeof summary === "object" ? summary : {},
      records: data,
    };
    const prompt = [
      "You are a pharmaceutical supply-chain operations analyst.",
      "Analyze every record in the supplied report data and write a detailed management report.",
      "Do not invent facts, medical advice, or values not present in the data.",
      "Use exactly these headings: Executive summary, Key findings, Recommended actions.",
      "Use all records, call out important individual records and patterns, and mention when the dataset is empty or limited.",
      JSON.stringify(reportPayload),
    ].join("\n\n");

    let response;
    let result = {};
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
            }),
            signal: controller.signal,
          }
        );
      } catch (err) {
        console.error("Gemini report generation request failed:", err.name === "AbortError" ? "request timed out" : err.message);
        response = null;
        break;
      } finally {
        clearTimeout(timeout);
      }
      result = await response.json().catch(() => ({}));
      if (response.ok || ![429, 500, 503].includes(response.status) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }

    const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!response?.ok || !text) {
      console.error("Gemini report generation failed:", result.error?.message || response?.status || "no response");
      return res.json({
        report: createFallbackReport(reportType, summary, data),
        recordsAnalyzed: data.length,
        source: "fallback",
      });
    }
    return res.json({ report: text, recordsAnalyzed: data.length, source: "gemini" });
  } catch (err) {
    console.error("AI report generation error:", err.message);
    return res.json({
      report: createFallbackReport(req.body?.reportType || "current report", req.body?.summary, Array.isArray(req.body?.data) ? req.body.data : []),
      recordsAnalyzed: Array.isArray(req.body?.data) ? req.body.data.length : 0,
      source: "fallback",
    });
  }
});

// 1. Sales Report: GET /api/reports/sales?startDate=...&endDate=...
router.get("/sales", requireAuth, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.saleDate = {};
      if (startDate) filter.saleDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.saleDate.$lte = end;
      }
    }

    // ⚡ Bolt: Added .lean() for read-only reports to prevent severe document hydration performance bottlenecks
    const invoices = await SaleInvoice.find(filter).sort({ saleDate: -1, createdAt: -1 }).lean();

    const totalInvoices = invoices.length;
    const totalQty = invoices.reduce((sum, inv) => sum + (inv.totalQty || 0), 0);
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const totalGst = invoices.reduce((sum, inv) => sum + (inv.gstAmount || 0), 0);
    const grandTotal = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

    return res.json({
      summary: { totalInvoices, totalQty, totalAmount, totalGst, grandTotal },
      data: invoices,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/grn", requireAuth, requirePermission("reports"), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.grnDate = {};
      if (startDate) filter.grnDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.grnDate.$lte = end;
      }
    }

    // ⚡ Bolt: Added .lean() for read-only reports to prevent severe document hydration performance bottlenecks
    const grns = await Grn.find(filter).sort({ grnDate: -1, createdAt: -1 }).lean();

    const totalGrns = grns.length;
    const totalQty = grns.reduce((sum, g) => sum + (g.totalQty || 0), 0);
    const totalValue = grns.reduce((sum, g) => sum + (g.totalValue || 0), 0);
    const totalGst = grns.reduce((sum, g) => sum + (g.gstAmount || 0), 0);
    const grandTotal = grns.reduce((sum, g) => sum + (g.grandTotal || 0), 0);

    return res.json({
      summary: { totalGrns, totalQty, totalValue, totalGst, grandTotal },
      data: grns,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/po", requireAuth, requirePermission("reports"), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) filter.orderDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.orderDate.$lte = end;
      }
    }

    // ⚡ Bolt: Added .lean() for read-only reports to prevent severe document hydration performance bottlenecks
    const pos = await PurchaseOrder.find(filter).sort({ orderDate: -1, createdAt: -1 }).lean();

    const totalPos = pos.length;
    const totalQty = pos.reduce((sum, p) => sum + (p.totalQty || 0), 0);
    const totalPrice = pos.reduce((sum, p) => sum + (p.totalPrice || 0), 0);
    const totalGst = pos.reduce((sum, p) => sum + (p.gstAmount || 0), 0);
    const grandTotal = pos.reduce((sum, p) => sum + (p.grandTotal || 0), 0);

    return res.json({
      summary: { totalPos, totalQty, totalPrice, totalGst, grandTotal },
      data: pos,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/near-expired", requireAuth, requirePermission("reports"), async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + days);
    futureDate.setHours(23, 59, 59, 999);

    const stocks = await Stock.find({
      qty: { $gt: 0 },
      expiryDate: { $gte: today, $lte: futureDate },
    // ⚡ Bolt: Added .lean() for read-only reports to prevent severe document hydration performance bottlenecks
    }).populate("sku").lean();

    const data = stocks
      .filter((s) => s.sku)
      .map((s) => ({
        stockId: s._id,
        skuId: s.sku._id,
        code: s.sku.code,
        skuName: s.sku.name,
        category: s.sku.category,
        batch: s.batch,
        expiryDate: s.expiryDate,
        mrp: s.mrp,
        rate: s.rate,
        qty: s.qty,
        totalValue: s.qty * s.rate,
      }));

    const totalBatches = data.length;
    const totalQty = data.reduce((sum, i) => sum + i.qty, 0);
    const totalValue = data.reduce((sum, i) => sum + i.totalValue, 0);

    return res.json({
      days,
      summary: { totalBatches, totalQty, totalValue },
      data,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/expired", requireAuth, requirePermission("reports"), async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stocks = await Stock.find({
      qty: { $gt: 0 },
      expiryDate: { $lt: today },
    // ⚡ Bolt: Added .lean() for read-only reports to prevent severe document hydration performance bottlenecks
    }).populate("sku").lean();

    const data = stocks
      .filter((s) => s.sku)
      .map((s) => ({
        stockId: s._id,
        skuId: s.sku._id,
        code: s.sku.code,
        skuName: s.sku.name,
        category: s.sku.category,
        batch: s.batch,
        expiryDate: s.expiryDate,
        mrp: s.mrp,
        rate: s.rate,
        qty: s.qty,
        totalValue: s.qty * s.rate,
      }));

    const totalBatches = data.length;
    const totalQty = data.reduce((sum, i) => sum + i.qty, 0);
    const totalValue = data.reduce((sum, i) => sum + i.totalValue, 0);

    return res.json({
      summary: { totalBatches, totalQty, totalValue },
      data,
    });
  } catch (err) {
    next(err);
  }
});

async function getSkuSalesActivity(daysLimit) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysLimit);

  const pipeline = [
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.sku",
        recentQtySold: {
          $sum: {
            $cond: [{ $gte: ["$saleDate", cutoffDate] }, "$items.qty", 0],
          },
        },
        lastSaleDate: { $max: "$saleDate" },
      },
    },
  ];

  const results = await SaleInvoice.aggregate(pipeline);
  const salesMap = {};
  for (const r of results) {
    salesMap[String(r._id)] = {
      recentQtySold: r.recentQtySold,
      lastSaleDate: r.lastSaleDate,
    };
  }
  return salesMap;
}

router.get("/slow-moving", requireAuth, requirePermission("reports"), async (req, res, next) => {
  try {
    const salesMap = await getSkuSalesActivity(30);

    const allSkus = await Sku.find().lean();
    const stocks = await Stock.aggregate([
      { $match: { qty: { $gt: 0 } } },
      { $group: { _id: "$sku", currentStockQty: { $sum: "$qty" } } },
    ]);

    const stockMap = {};
    for (const s of stocks) {
      stockMap[String(s._id)] = s.currentStockQty;
    }

    const data = [];
    for (const sku of allSkus) {
      const skuIdStr = String(sku._id);
      const stockQty = stockMap[skuIdStr] || 0;
      if (stockQty <= 0) continue;

      const activity = salesMap[skuIdStr] || { recentQtySold: 0, lastSaleDate: null };

      if (activity.recentQtySold === 0) {
        data.push({
          skuId: sku._id,
          code: sku.code,
          name: sku.name,
          category: sku.category,
          manufacturer: sku.manufacturer,
          uom: sku.uom,
          currentStockQty: stockQty,
          lastSaleDate: activity.lastSaleDate,
        });
      }
    }

    const totalItems = data.length;
    const totalStockQty = data.reduce((sum, i) => sum + i.currentStockQty, 0);

    return res.json({
      summary: { totalItems, totalStockQty },
      data,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/non-moving", requireAuth, requirePermission("reports"), async (req, res, next) => {
  try {
    const salesMap = await getSkuSalesActivity(60);

    const allSkus = await Sku.find().lean();
    const stocks = await Stock.aggregate([
      { $match: { qty: { $gt: 0 } } },
      { $group: { _id: "$sku", currentStockQty: { $sum: "$qty" } } },
    ]);

    const stockMap = {};
    for (const s of stocks) {
      stockMap[String(s._id)] = s.currentStockQty;
    }

    const data = [];
    for (const sku of allSkus) {
      const skuIdStr = String(sku._id);
      const stockQty = stockMap[skuIdStr] || 0;
      if (stockQty <= 0) continue;

      const activity = salesMap[skuIdStr] || { recentQtySold: 0, lastSaleDate: null };

      if (activity.recentQtySold === 0) {
        data.push({
          skuId: sku._id,
          code: sku.code,
          name: sku.name,
          category: sku.category,
          manufacturer: sku.manufacturer,
          uom: sku.uom,
          currentStockQty: stockQty,
          lastSaleDate: activity.lastSaleDate,
        });
      }
    }

    const totalItems = data.length;
    const totalStockQty = data.reduce((sum, i) => sum + i.currentStockQty, 0);

    return res.json({
      summary: { totalItems, totalStockQty },
      data,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
