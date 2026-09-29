const express = require("express");
const { requireAuth } = require("../middleware/auth");
const SaleInvoice = require("../models/SaleInvoice");
const Grn = require("../models/Grn");
const PurchaseOrder = require("../models/PurchaseOrder");
const Stock = require("../models/Stock");
const Sku = require("../models/Sku");

const router = express.Router();

// 1. Sales Report: GET /api/reports/sales?startDate=...&endDate=...
router.get("/sales", requireAuth, async (req, res) => {
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
    return res.status(500).json({ error: err.message });
  }
});

// 2. GRN Report: GET /api/reports/grn?startDate=...&endDate=...
router.get("/grn", requireAuth, async (req, res) => {
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
    return res.status(500).json({ error: err.message });
  }
});

// 3. PO Report: GET /api/reports/po?startDate=...&endDate=...
router.get("/po", requireAuth, async (req, res) => {
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
    return res.status(500).json({ error: err.message });
  }
});

// 4. Near Expired Report: GET /api/reports/near-expired?days=30
router.get("/near-expired", requireAuth, async (req, res) => {
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
    return res.status(500).json({ error: err.message });
  }
});

// 5. Expired Report: GET /api/reports/expired
router.get("/expired", requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stocks = await Stock.find({
      qty: { $gt: 0 },
      expiryDate: { $lt: today },
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
    return res.status(500).json({ error: err.message });
  }
});

// Helper function to get SKU sale activity summary
async function getSkuSalesActivity(daysLimit) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysLimit);

  // Aggregate total sales per SKU in recent timeframe and overall last sale date
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

// 6. Slow Moving Report: GET /api/reports/slow-moving (no sales in last 1 month / 30 days)
router.get("/slow-moving", requireAuth, async (req, res) => {
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
      if (stockQty <= 0) continue; // only items currently in stock

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
    return res.status(500).json({ error: err.message });
  }
});

// 7. Non Moving Report: GET /api/reports/non-moving (no sales in 2+ months / 60 days)
router.get("/non-moving", requireAuth, async (req, res) => {
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
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
