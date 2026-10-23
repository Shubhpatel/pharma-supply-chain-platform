"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

function exportToCsv(filename, headers, rows) {
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function createLocalReport(reportTitle, summary, data) {
  const metrics = Object.entries(summary || {})
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
  return [
    "Executive summary",
    `The ${reportTitle} contains ${data.length} record(s). ${metrics || "No aggregate metrics were provided."}`,
    "",
    "Key findings",
    `- Review the ${data.length} record(s) included in this report.`,
    "",
    "Recommended actions",
    "- Prioritize exceptions with the highest quantity, value, or expiry risk.",
    "- Try AI insights again later when the provider is available.",
  ].join("\n");
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const { token, user } = useApp();

  const [activeTab, setActiveTab] = useState("sales");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filter states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [nearExpiredDays, setNearExpiredDays] = useState("30");

  // Report Data States
  const [reportData, setReportData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [aiReport, setAiReport] = useState("");
  const [aiSource, setAiSource] = useState("");
  const [aiRecordsAnalyzed, setAiRecordsAnalyzed] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["sales", "grn", "near-expired", "expired", "po", "slow-moving", "non-moving"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && token) {
      loadReportData();
    }
  }, [activeTab, nearExpiredDays, token, user]);

  async function loadReportData() {
    setLoading(true);
    setError("");
    setReportData([]);
    setSummary(null);
    setAiReport("");
    setAiSource("");
    setAiRecordsAnalyzed(0);
    setAiError("");

    try {
      let res;
      if (activeTab === "sales") {
        res = await api.getSalesReport({ startDate, endDate }, token);
      } else if (activeTab === "grn") {
        res = await api.getGrnReport({ startDate, endDate }, token);
      } else if (activeTab === "po") {
        res = await api.getPoReport({ startDate, endDate }, token);
      } else if (activeTab === "near-expired") {
        res = await api.getNearExpiredReport(nearExpiredDays, token);
      } else if (activeTab === "expired") {
        res = await api.getExpiredReport(token);
      } else if (activeTab === "slow-moving") {
        res = await api.getSlowMovingReport(token);
      } else if (activeTab === "non-moving") {
        res = await api.getNonMovingReport(token);
      }

      if (res) {
        setReportData(res.data || []);
        setSummary(res.summary || null);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch report data");
    } finally {
      setLoading(false);
    }
  }

  function handleFilterSubmit(e) {
    e.preventDefault();
    loadReportData();
  }

  async function handleGenerateAiReport() {
    setAiLoading(true);
    setAiError("");
    try {
      const result = await api.generateAiReport(
        { reportType: reportTitle, summary, data: reportData },
        token
      );
      setAiReport(result.report);
      setAiSource(result.source || "gemini");
      setAiRecordsAnalyzed(result.recordsAnalyzed || reportData.length);
      setShowAiModal(true);
    } catch (err) {
      setAiReport(createLocalReport(reportTitle, summary, reportData));
      setAiSource("fallback");
      setAiRecordsAnalyzed(reportData.length);
      setAiError("");
      setShowAiModal(true);
    } finally {
      setAiLoading(false);
    }
  }

  function handleExportCsv() {
    if (!reportData || reportData.length === 0) return;

    let headers = [];
    let rows = [];

    if (activeTab === "sales") {
      headers = ["Invoice #", "Customer Name", "Sale Date", "Total Qty", "Total Amount", "GST Amount", "Grand Total"];
      rows = reportData.map((d) => [
        d.invoiceNumber,
        d.customerName,
        new Date(d.saleDate).toLocaleDateString(),
        d.totalQty,
        d.totalAmount,
        d.gstAmount,
        d.grandTotal,
      ]);
    } else if (activeTab === "grn") {
      headers = ["GRN #", "PO #", "Supplier Name", "GRN Date", "Invoice #", "Total Qty", "Total Value", "GST Amount", "Grand Total"];
      rows = reportData.map((d) => [
        d.grnNumber,
        d.poNumber || "-",
        d.supplierName,
        new Date(d.grnDate).toLocaleDateString(),
        d.purchaseInvoiceNumber,
        d.totalQty,
        d.totalValue,
        d.gstAmount,
        d.grandTotal,
      ]);
    } else if (activeTab === "po") {
      headers = ["PO #", "Supplier Name", "Order Date", "Payment Term", "Status", "Total Qty", "Total Price", "GST Amount", "Grand Total"];
      rows = reportData.map((d) => [
        d.poNumber,
        d.supplierName,
        new Date(d.orderDate).toLocaleDateString(),
        d.paymentTerm || "-",
        d.status,
        d.totalQty,
        d.totalPrice,
        d.gstAmount,
        d.grandTotal,
      ]);
    } else if (activeTab === "near-expired" || activeTab === "expired") {
      headers = ["SKU Code", "SKU Name", "Category", "Batch", "Expiry Date", "MRP", "Rate", "Qty in Stock", "Total Value"];
      rows = reportData.map((d) => [
        d.code || "-",
        d.skuName,
        d.category || "-",
        d.batch,
        new Date(d.expiryDate).toLocaleDateString(),
        d.mrp,
        d.rate,
        d.qty,
        d.totalValue,
      ]);
    } else if (activeTab === "slow-moving" || activeTab === "non-moving") {
      headers = ["SKU Code", "SKU Name", "Category", "Manufacturer", "UOM", "Current Stock Qty", "Last Sale Date"];
      rows = reportData.map((d) => [
        d.code || "-",
        d.name,
        d.category || "-",
        d.manufacturer || "-",
        d.uom,
        d.currentStockQty,
        d.lastSaleDate ? new Date(d.lastSaleDate).toLocaleDateString() : "Never Sold",
      ]);
    }

    exportToCsv(`${activeTab}-report`, headers, rows);
  }

  const reportTitles = {
    sales: "Sales Report",
    grn: "GRN Report",
    "near-expired": "Near Expired Report",
    expired: "Expired Report",
    po: "PO Report",
    "slow-moving": "Slow Moving Report",
    "non-moving": "Non Moving Report",
  };
  const reportTitle = reportTitles[activeTab] || "Reports & Analytics";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{reportTitle}</h1>
        <button
          onClick={handleExportCsv}
          disabled={!reportData.length || loading}
          className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-medium hover:bg-teal-900 disabled:opacity-50 self-start sm:self-auto"
        >
          Export to CSV / Excel
        </button>
      </div>

      <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-teal-900">Full AI report</h2>
            <p className="text-xs text-teal-700 mt-1">
              Analyze all {reportData.length} records and review the complete dataset in the table below.
            </p>
          </div>
          <button
            onClick={handleGenerateAiReport}
            disabled={aiLoading || loading || !reportData.length}
            className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-medium hover:bg-teal-900 disabled:opacity-50"
          >
            {aiLoading ? "Generating..." : "Generate Full AI Report"}
          </button>
        </div>
        {aiError && <p className="text-sm text-red-600 mt-3">{aiError}</p>}
        {aiReport && (
          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className="mt-3 text-sm font-medium text-teal-800 hover:underline"
          >
            View generated report
          </button>
        )}
      </div>

      {showAiModal && aiReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-report-title"
          onClick={() => setShowAiModal(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 id="ai-report-title" className="text-lg font-semibold text-gray-900">
                  Full AI report
                </h2>
                <p className="text-xs text-gray-500">
                  Complete report data: {aiRecordsAnalyzed} record(s) included.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="rounded-md px-3 py-1 text-2xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close AI report"
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto p-5 text-sm leading-6 text-gray-800 whitespace-pre-wrap">
              {aiSource === "fallback" && (
                <p className="mb-4 rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-700">
                  Gemini is temporarily busy, so these insights were generated from the report data without AI.
                </p>
              )}
              {aiReport}
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 border border-gray-200 rounded-lg flex flex-wrap items-center gap-4 text-sm">
        {["sales", "grn", "po"].includes(activeTab) && (
          <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-gray-600 font-medium">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-600 font-medium">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1 bg-gray-900 text-white rounded text-sm hover:bg-gray-800"
            >
              Filter
            </button>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setTimeout(loadReportData, 0);
                }}
                className="text-xs text-gray-500 hover:underline"
              >
                Clear
              </button>
            )}
          </form>
        )}

        {activeTab === "near-expired" && (
          <div className="flex items-center gap-2">
            <label className="text-gray-600 font-medium">Expiring within:</label>
            <select
              value={nearExpiredDays}
              onChange={(e) => setNearExpiredDays(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1 text-sm bg-white"
            >
              <option value="15">15 Days</option>
              <option value="30">30 Days</option>
              <option value="60">60 Days</option>
              <option value="90">90 Days</option>
            </select>
          </div>
        )}

        {activeTab === "slow-moving" && (
          <p className="text-gray-600 text-xs sm:text-sm">
            Showing items with <strong>no sales in the last 1 month (30 days)</strong> that currently have available stock.
          </p>
        )}

        {activeTab === "non-moving" && (
          <p className="text-gray-600 text-xs sm:text-sm">
            Showing items with <strong>no sales in 2+ months (60+ days)</strong> that currently have available stock.
          </p>
        )}
      </div>

      {/* Summary Metrics */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {summary.totalInvoices !== undefined && (
            <div className="bg-teal-50 border border-teal-100 p-3 rounded-lg">
              <span className="text-xs text-teal-600 font-medium block">Total Invoices</span>
              <span className="text-lg font-bold text-teal-900">{summary.totalInvoices}</span>
            </div>
          )}
          {summary.totalGrns !== undefined && (
            <div className="bg-teal-50 border border-teal-100 p-3 rounded-lg">
              <span className="text-xs text-teal-600 font-medium block">Total GRNs</span>
              <span className="text-lg font-bold text-teal-900">{summary.totalGrns}</span>
            </div>
          )}
          {summary.totalPos !== undefined && (
            <div className="bg-teal-50 border border-teal-100 p-3 rounded-lg">
              <span className="text-xs text-teal-600 font-medium block">Total POs</span>
              <span className="text-lg font-bold text-teal-900">{summary.totalPos}</span>
            </div>
          )}
          {summary.totalBatches !== undefined && (
            <div className="bg-teal-50 border border-teal-100 p-3 rounded-lg">
              <span className="text-xs text-teal-600 font-medium block">Total Batches</span>
              <span className="text-lg font-bold text-teal-900">{summary.totalBatches}</span>
            </div>
          )}
          {summary.totalItems !== undefined && (
            <div className="bg-teal-50 border border-teal-100 p-3 rounded-lg">
              <span className="text-xs text-teal-600 font-medium block">Total SKUs</span>
              <span className="text-lg font-bold text-teal-900">{summary.totalItems}</span>
            </div>
          )}
          {summary.totalQty !== undefined && (
            <div className="bg-teal-50 border border-teal-100 p-3 rounded-lg">
              <span className="text-xs text-teal-600 font-medium block">Total Quantity</span>
              <span className="text-lg font-bold text-teal-900">{summary.totalQty}</span>
            </div>
          )}
          {summary.totalStockQty !== undefined && (
            <div className="bg-teal-50 border border-teal-100 p-3 rounded-lg">
              <span className="text-xs text-teal-600 font-medium block">Total Stock Qty</span>
              <span className="text-lg font-bold text-teal-900">{summary.totalStockQty}</span>
            </div>
          )}
          {summary.totalAmount !== undefined && (
            <div className="bg-teal-50 border border-teal-100 p-3 rounded-lg">
              <span className="text-xs text-teal-600 font-medium block">Total Amount</span>
              <span className="text-lg font-bold text-teal-900">₹{summary.totalAmount.toFixed(2)}</span>
            </div>
          )}
          {summary.totalValue !== undefined && (
            <div className="bg-teal-50 border border-teal-100 p-3 rounded-lg">
              <span className="text-xs text-teal-600 font-medium block">Total Stock Value</span>
              <span className="text-lg font-bold text-teal-900">₹{summary.totalValue.toFixed(2)}</span>
            </div>
          )}
          {summary.grandTotal !== undefined && (
            <div className="bg-teal-50 border border-teal-100 p-3 rounded-lg">
              <span className="text-xs text-teal-600 font-medium block">Grand Total</span>
              <span className="text-lg font-bold text-teal-900">₹{summary.grandTotal.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      {/* Error / Loading */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 py-4">Loading report data...</p>
      ) : reportData.length === 0 ? (
        <div className="border border-gray-200 rounded-lg p-8 bg-white text-center text-gray-500 text-sm">
          No records found for this report and filter criteria.
        </div>
      ) : (
        /* Data Table */
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              {activeTab === "sales" && (
                <tr>
                  <th className="px-4 py-2">Invoice #</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Sale Date</th>
                  <th className="px-4 py-2 text-right">Total Qty</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">GST</th>
                  <th className="px-4 py-2 text-right">Grand Total</th>
                </tr>
              )}
              {activeTab === "grn" && (
                <tr>
                  <th className="px-4 py-2">GRN #</th>
                  <th className="px-4 py-2">PO #</th>
                  <th className="px-4 py-2">Supplier</th>
                  <th className="px-4 py-2">GRN Date</th>
                  <th className="px-4 py-2">Inv #</th>
                  <th className="px-4 py-2 text-right">Total Qty</th>
                  <th className="px-4 py-2 text-right">Value</th>
                  <th className="px-4 py-2 text-right">GST</th>
                  <th className="px-4 py-2 text-right">Grand Total</th>
                </tr>
              )}
              {activeTab === "po" && (
                <tr>
                  <th className="px-4 py-2">PO #</th>
                  <th className="px-4 py-2">Supplier</th>
                  <th className="px-4 py-2">Order Date</th>
                  <th className="px-4 py-2">Payment Term</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Total Qty</th>
                  <th className="px-4 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-right">GST</th>
                  <th className="px-4 py-2 text-right">Grand Total</th>
                </tr>
              )}
              {(activeTab === "near-expired" || activeTab === "expired") && (
                <tr>
                  <th className="px-4 py-2">SKU Name</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Batch</th>
                  <th className="px-4 py-2">Expiry Date</th>
                  <th className="px-4 py-2 text-right">MRP</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Total Value</th>
                </tr>
              )}
              {(activeTab === "slow-moving" || activeTab === "non-moving") && (
                <tr>
                  <th className="px-4 py-2">SKU Code</th>
                  <th className="px-4 py-2">SKU Name</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Manufacturer</th>
                  <th className="px-4 py-2">UOM</th>
                  <th className="px-4 py-2 text-right">Stock Qty</th>
                  <th className="px-4 py-2">Last Sale Date</th>
                </tr>
              )}
            </thead>
            <tbody>
              {activeTab === "sales" &&
                reportData.map((d) => (
                  <tr key={d._id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-900">{d.invoiceNumber}</td>
                    <td className="px-4 py-2">{d.customerName}</td>
                    <td className="px-4 py-2">{new Date(d.saleDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-right">{d.totalQty}</td>
                    <td className="px-4 py-2 text-right">₹{d.totalAmount?.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">₹{d.gstAmount?.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-medium">₹{d.grandTotal?.toFixed(2)}</td>
                  </tr>
                ))}
              {activeTab === "grn" &&
                reportData.map((d) => (
                  <tr key={d._id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-900">{d.grnNumber}</td>
                    <td className="px-4 py-2">{d.poNumber || "-"}</td>
                    <td className="px-4 py-2">{d.supplierName}</td>
                    <td className="px-4 py-2">{new Date(d.grnDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2">{d.purchaseInvoiceNumber}</td>
                    <td className="px-4 py-2 text-right">{d.totalQty}</td>
                    <td className="px-4 py-2 text-right">₹{d.totalValue?.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">₹{d.gstAmount?.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-medium">₹{d.grandTotal?.toFixed(2)}</td>
                  </tr>
                ))}
              {activeTab === "po" &&
                reportData.map((d) => (
                  <tr key={d._id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-900">{d.poNumber}</td>
                    <td className="px-4 py-2">{d.supplierName}</td>
                    <td className="px-4 py-2">{new Date(d.orderDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2">{d.paymentTerm || "-"}</td>
                    <td className="px-4 py-2 capitalize">{d.status}</td>
                    <td className="px-4 py-2 text-right">{d.totalQty}</td>
                    <td className="px-4 py-2 text-right">₹{d.totalPrice?.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">₹{d.gstAmount?.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-medium">₹{d.grandTotal?.toFixed(2)}</td>
                  </tr>
                ))}
              {(activeTab === "near-expired" || activeTab === "expired") &&
                reportData.map((d) => (
                  <tr key={d.stockId} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-900">{d.skuName}</td>
                    <td className="px-4 py-2">{d.category || "-"}</td>
                    <td className="px-4 py-2 font-mono text-xs">{d.batch}</td>
                    <td className="px-4 py-2">{new Date(d.expiryDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-right">₹{d.mrp?.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">₹{d.rate?.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{d.qty}</td>
                    <td className="px-4 py-2 text-right font-medium">₹{d.totalValue?.toFixed(2)}</td>
                  </tr>
                ))}
              {(activeTab === "slow-moving" || activeTab === "non-moving") &&
                reportData.map((d) => (
                  <tr key={d.skuId} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-500">{d.code || "-"}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{d.name}</td>
                    <td className="px-4 py-2">{d.category || "-"}</td>
                    <td className="px-4 py-2">{d.manufacturer || "-"}</td>
                    <td className="px-4 py-2">{d.uom}</td>
                    <td className="px-4 py-2 text-right font-medium">{d.currentStockQty}</td>
                    <td className="px-4 py-2">
                      {d.lastSaleDate ? new Date(d.lastSaleDate).toLocaleDateString() : "Never Sold"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Loading reports...</p>}>
      <ReportsContent />
    </Suspense>
  );
}
