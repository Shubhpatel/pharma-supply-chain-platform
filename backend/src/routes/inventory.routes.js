const express = require("express");
const { requireAuth, requirePermission } = require("../middleware/auth");
const Stock = require("../models/Stock");
const Grn = require("../models/Grn");
const SaleInvoice = require("../models/SaleInvoice");
const DebitNote = require("../models/DebitNote");
const CreditNote = require("../models/CreditNote");
const SkuLocation = require("../models/SkuLocation");

const router = express.Router();

// GET /api/inventory - stock on hand, joined with SKU details
router.get("/", requireAuth, requirePermission("inventory"), async (req, res, next) => {
  try {
    const stock = await Stock.find({ qty: { $gt: 0 } })
      .populate("sku", "name category subCategory manufacturer uom")
      .lean();
    const skuIds = stock.filter((item) => item.sku).map((item) => item.sku._id);
    const locations = await SkuLocation.find({ sku: { $in: skuIds }, enabled: true })
      .select("sku location")
      .lean();
    const locationsBySku = new Map(locations.map((entry) => [String(entry.sku), entry.location]));

    // Only show rows where the SKU still exists (in case one was hard-deleted from Masters).
    const rows = stock
      .filter((s) => s.sku)
      .map((s) => ({
        skuId: s.sku._id,
        location: locationsBySku.get(String(s.sku._id)) || "-",
        name: s.sku.name,
        category: s.sku.category,
        subCategory: s.sku.subCategory,
        manufacturer: s.sku.manufacturer,
        uom: s.sku.uom,
        batch: s.batch,
        expiryDate: s.expiryDate,
        mrp: s.mrp,
        rate: s.rate,
        qty: s.qty,
      }));
    return res.json({ stock: rows });
  } catch (err) {
    console.error("Inventory error:", err);
    next(err);
  }
});

// GET /api/inventory/history/:skuId - transaction history for a product (or "all")
router.get("/history/:skuId", requireAuth, requirePermission("inventory"), async (req, res, next) => {
  try {
    const { skuId } = req.params;
    const { batch, type, startDate, endDate, partyName, docNumber } = req.query;

    const queryFilter = skuId === "all" ? {} : { "items.sku": skuId };
    const confirmedFilter = { ...queryFilter, status: "confirmed" };

    const [grns, sales, debitNotes, creditNotes] = await Promise.all([
      Grn.find(confirmedFilter).populate("createdBy", "name").lean(),
      SaleInvoice.find(confirmedFilter).populate("createdBy", "name").lean(),
      DebitNote.find(confirmedFilter).populate("createdBy", "name").lean(),
      CreditNote.find(confirmedFilter).populate("createdBy", "name").lean(),
    ]);

    let allTransactions = [];

    grns.forEach((grn) => {
      grn.items.forEach((item, idx) => {
        if (skuId === "all" || item.sku.toString() === skuId) {
          allTransactions.push({
            id: `grn-${grn._id}-${idx}`,
            docId: grn._id,
            docNumber: grn.grnNumber,
            type: "GRN",
            date: new Date(grn.grnDate),
            partyName: grn.supplierName || "-",
            skuId: item.sku.toString(),
            skuName: item.skuName || "Product",
            batch: item.batch,
            expiryDate: item.expiryDate,
            mrp: item.mrp,
            rate: item.rate,
            qty: Number(item.qtyReceived) || 0,
            amount: item.amount,
            docLink: `/grn/${grn._id}`,
            createdByName: grn.createdBy?.name || "-",
            createdAt: grn.createdAt || grn.grnDate,
          });
        }
      });
    });

    sales.forEach((sale) => {
      sale.items.forEach((item, idx) => {
        if (skuId === "all" || item.sku.toString() === skuId) {
          allTransactions.push({
            id: `sales-${sale._id}-${idx}`,
            docId: sale._id,
            docNumber: sale.invoiceNumber,
            type: "Sales",
            date: new Date(sale.saleDate),
            partyName: sale.customerName || "-",
            skuId: item.sku.toString(),
            skuName: item.skuName || "Product",
            batch: item.batch,
            expiryDate: item.expiryDate,
            mrp: item.mrp,
            rate: item.rate,
            qty: -(Number(item.qty) || 0),
            amount: item.amount,
            docLink: `/sales/${sale._id}`,
            createdByName: sale.createdBy?.name || "-",
            createdAt: sale.createdAt || sale.saleDate,
          });
        }
      });
    });

    debitNotes.forEach((dn) => {
      dn.items.forEach((item, idx) => {
        if (skuId === "all" || item.sku.toString() === skuId) {
          allTransactions.push({
            id: `pr-${dn._id}-${idx}`,
            docId: dn._id,
            docNumber: dn.debitNoteNumber,
            type: "PR",
            date: new Date(dn.returnDate),
            partyName: dn.supplierName || "-",
            skuId: item.sku.toString(),
            skuName: item.skuName || "Product",
            batch: item.batch,
            expiryDate: item.expiryDate,
            mrp: item.mrp,
            rate: item.rate,
            qty: -(Number(item.qty) || 0),
            amount: item.amount,
            docLink: `/purchase/returns/${dn._id}`,
            createdByName: dn.createdBy?.name || "-",
            createdAt: dn.createdAt || dn.returnDate,
          });
        }
      });
    });

    creditNotes.forEach((cn) => {
      cn.items.forEach((item, idx) => {
        if (skuId === "all" || item.sku.toString() === skuId) {
          allTransactions.push({
            id: `sr-${cn._id}-${idx}`,
            docId: cn._id,
            docNumber: cn.creditNoteNumber,
            type: "SR",
            date: new Date(cn.returnDate),
            partyName: cn.customerName || "-",
            skuId: item.sku.toString(),
            skuName: item.skuName || "Product",
            batch: item.batch,
            expiryDate: item.expiryDate,
            mrp: item.mrp,
            rate: item.rate,
            qty: Number(item.qty) || 0,
            amount: item.amount,
            docLink: `/sales/returns/${cn._id}`,
            createdByName: cn.createdBy?.name || "-",
            createdAt: cn.createdAt || cn.returnDate,
          });
        }
      });
    });

    if (batch) {
      allTransactions = allTransactions.filter(
        (t) => t.batch && t.batch.toLowerCase().includes(batch.toLowerCase())
      );
    }

    allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date) || new Date(a.createdAt) - new Date(b.createdAt));

    if (skuId !== "all") {
      let currentBalance = 0;
      allTransactions.forEach((t) => {
        currentBalance += t.qty;
        t.runningBalance = currentBalance;
      });
    } else {
      const skuBalances = {};
      allTransactions.forEach((t) => {
        if (!skuBalances[t.skuId]) skuBalances[t.skuId] = 0;
        skuBalances[t.skuId] += t.qty;
        t.runningBalance = skuBalances[t.skuId];
      });
    }

    if (type) {
      allTransactions = allTransactions.filter((t) => t.type === type);
    }

    if (partyName) {
      allTransactions = allTransactions.filter(
        (t) => t.partyName && t.partyName.toLowerCase().includes(partyName.toLowerCase())
      );
    }

    if (docNumber) {
      allTransactions = allTransactions.filter(
        (t) => t.docNumber && t.docNumber.toLowerCase().includes(docNumber.toLowerCase())
      );
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      allTransactions = allTransactions.filter((t) => new Date(t.date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      allTransactions = allTransactions.filter((t) => new Date(t.date) <= end);
    }

    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ transactions: allTransactions });
  } catch (err) {
    console.error("Inventory history error:", err);
    next(err);
  }
});

module.exports = router;
