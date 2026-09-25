"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import SearchableSelect from "@/components/SearchableSelect";

export default function TransactionHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const selectedSkuId = params.skuId;

  const [skus, setSkus] = useState([]);
  const [stock, setStock] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [typeFilter, setTypeFilter] = useState("");
  const [partyFilter, setPartyFilter] = useState("");
  const [docNumberFilter, setDocNumberFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    type: "",
    partyName: "",
    docNumber: "",
    batch: "",
    startDate: "",
    endDate: "",
  });

  // Load product and stock data for the current product summary
  useEffect(() => {
    Promise.all([api.listSkus(), api.listStock()])
      .then(([skuData, stockData]) => {
        setSkus(skuData.skus || []);
        setStock(stockData.stock || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedSkuId || selectedSkuId === "all") {
      router.replace("/inventory");
    }
  }, [router, selectedSkuId]);

  // Load transactions
  const fetchTransactions = () => {
    if (!selectedSkuId || selectedSkuId === "all") return;

    setLoading(true);
    setError("");
    api
      .getInventoryHistory(selectedSkuId, {
        ...appliedFilters,
      })
      .then((data) => setTransactions(data.transactions || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedSkuId, appliedFilters]);

  const currentSku = useMemo(() => {
    return skus.find((s) => s._id === selectedSkuId);
  }, [skus, selectedSkuId]);

  const batchOptions = useMemo(() => {
    return [...new Set(transactions.map((transaction) => transaction.batch).filter(Boolean))]
      .sort()
      .map((batch) => ({ value: batch, label: batch }));
  }, [transactions]);

  // Calculate stock summary metrics for the current product.
  const metrics = useMemo(() => {
    const productStock = stock.filter((item) => item.skuId === selectedSkuId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nearExpiryDate = new Date(today);
    nearExpiryDate.setDate(today.getDate() + 30);

    const nearExpiryQty = productStock.reduce((sum, item) => {
      const expiryDate = new Date(item.expiryDate);
      return item.qty > 0 && expiryDate >= today && expiryDate <= nearExpiryDate
        ? sum + Number(item.qty)
        : sum;
    }, 0);
    const expiredQty = productStock.reduce((sum, item) => {
      return item.qty > 0 && new Date(item.expiryDate) < today
        ? sum + Number(item.qty)
        : sum;
    }, 0);
    const totalQty = productStock.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const sellableQty = productStock.reduce((sum, item) => {
      return item.qty > 0 && new Date(item.expiryDate) >= today
        ? sum + Number(item.qty)
        : sum;
    }, 0);

    return {
      totalBatchCount: productStock.length,
      nearExpiryQty,
      expiredQty,
      totalQty,
      sellableQty,
    };
  }, [selectedSkuId, stock]);

  // CSV Export
  const exportToCSV = () => {
    if (!transactions.length) return;

    const headers = [
      "Date",
      "Product Name",
      "Type",
      "Ref No",
      "Party Name",
      "Batch",
      "Expiry Date",
      "MRP",
      "Rate",
      "Qty",
      "Amount",
      "Running Balance",
      "Created By",
    ];

    const rows = transactions.map((t) => [
      t.date ? new Date(t.date).toLocaleDateString() : "-",
      `"${(t.skuName || "").replace(/"/g, '""')}"`,
      t.type,
      t.docNumber,
      `"${(t.partyName || "").replace(/"/g, '""')}"`,
      `"${(t.batch || "").replace(/"/g, '""')}"`,
      t.expiryDate ? new Date(t.expiryDate).toLocaleDateString() : "-",
      t.mrp == null ? "" : Number(t.mrp).toFixed(2),
      t.rate == null ? "" : Number(t.rate).toFixed(2),
      t.qty,
      t.amount == null ? "" : Number(t.amount).toFixed(2),
      t.runningBalance != null ? t.runningBalance : "",
      `"${(t.createdByName || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const skuName = currentSku ? currentSku.name.replace(/[^a-zA-Z0-9]/g, "_") : "all_products";
    link.setAttribute("download", `inventory_history_${skuName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/inventory" className="hover:text-gray-900 hover:underline">
              Inventory
            </Link>
            <span>/</span>
            <span className="font-medium text-gray-800">Transaction History</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {currentSku ? `History: ${currentSku.name}` : "Product Transaction History"}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportToCSV}
            disabled={transactions.length === 0}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Product Summary Bar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="w-full md:w-auto flex-1 max-w-md">
          <p className="text-xs font-semibold text-gray-700">Product</p>
          <p className="text-sm text-gray-900 mt-1">{currentSku?.name || "Loading product..."}</p>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 w-full md:w-auto">
          <div className="bg-gray-50 border border-gray-100 p-3 rounded-md text-center">
            <span className="block text-[11px] font-medium text-gray-500">Total Batches</span>
            <span className="text-lg font-bold text-gray-800">{metrics.totalBatchCount}</span>
          </div>
          <div className="bg-green-50 border border-green-100 p-3 rounded-md text-center">
            <span className="block text-[11px] font-medium text-green-600">Near Expiry Qty</span>
            <span className="text-lg font-bold text-green-700">{metrics.nearExpiryQty}</span>
          </div>
          <div className="bg-red-50 border border-red-100 p-3 rounded-md text-center">
            <span className="block text-[11px] font-medium text-red-600">Expired Qty</span>
            <span className="text-lg font-bold text-red-700">{metrics.expiredQty}</span>
          </div>
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-md text-center">
            <span className="block text-[11px] font-medium text-blue-600">Total Qty</span>
            <span className="text-lg font-bold text-blue-700">{metrics.totalQty}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-md text-center">
            <span className="block text-[11px] font-medium text-emerald-600">Sellable Qty</span>
            <span className="text-lg font-bold text-emerald-700">{metrics.sellableQty}</span>
          </div>
        </div>
      </div>

      {/* Comprehensive Filter Panel */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
        <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wider">Filter Transactions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Transaction Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white"
            >
              <option value="">All Types (GRN, Sales, PR, SR)</option>
              <option value="GRN">GRN (Stock IN)</option>
              <option value="Sales">Sales Invoice (Stock OUT)</option>
              <option value="PR">PR / Debit Note (Stock OUT)</option>
              <option value="SR">SR / Credit Note (Stock IN)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Party Name (Vendor/Customer)</label>
            <input
              type="text"
              placeholder="Search Party Name..."
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ref / Document No.</label>
            <input
              type="text"
              placeholder="e.g. GRN-001, INV-001"
              value={docNumberFilter}
              onChange={(e) => setDocNumberFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Batch Number</label>
            <SearchableSelect
              value={batchFilter}
              onChange={setBatchFilter}
              options={batchOptions}
              placeholder="Search Batch..."
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setAppliedFilters({
              type: typeFilter,
              partyName: partyFilter,
              docNumber: docNumberFilter,
              batch: batchFilter,
              startDate,
              endDate,
            })}
            className="rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            Filter
          </button>
          {(typeFilter || partyFilter || docNumberFilter || batchFilter || startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter("");
                setPartyFilter("");
                setDocNumberFilter("");
                setBatchFilter("");
                setStartDate("");
                setEndDate("");
                setAppliedFilters({
                  type: "",
                  partyName: "",
                  docNumber: "",
                  batch: "",
                  startDate: "",
                  endDate: "",
                });
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white p-8 text-center text-gray-500 rounded-lg border border-gray-200">
          Loading transaction history...
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white p-8 text-center text-gray-500 rounded-lg border border-gray-200 italic">
          No transactions found for the selected criteria.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-700 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Date</th>
                {selectedSkuId === "all" && <th className="px-4 py-3">Product Name</th>}
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Ref No.</th>
                <th className="px-4 py-3">Party Name</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Exp Date</th>
                <th className="px-4 py-3">MRP</th>
                <th className="px-4 py-3">Rate</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Running Balance</th>
                <th className="px-4 py-3">Created By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-700">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {t.date ? new Date(t.date).toLocaleDateString() : "-"}
                  </td>
                  {selectedSkuId === "all" && (
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 text-xs">
                      {t.skuName}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded ${
                        t.type === "GRN"
                          ? "bg-green-100 text-green-800"
                          : t.type === "Sales"
                          ? "bg-blue-100 text-blue-800"
                          : t.type === "PR"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-xs">
                    <Link href={t.docLink} className="text-blue-600 hover:underline">
                      {t.docNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">{t.partyName}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 text-xs">
                    {t.batch || "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {t.expiryDate ? new Date(t.expiryDate).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {t.mrp == null ? "-" : `₹${Number(t.mrp).toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {t.rate == null ? "-" : `₹${Number(t.rate).toFixed(2)}`}
                  </td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap font-bold text-xs ${
                      t.qty > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {t.qty > 0 ? `+${t.qty}` : t.qty}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">
                    {t.amount == null ? "-" : `₹${Number(t.amount).toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-900 text-xs">
                    {t.runningBalance != null ? t.runningBalance : "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">{t.createdByName || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
