"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function InventoryPage() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState("");
  const [category, setCategory] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [stockLevel, setStockLevel] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ search: "", batch: "", category: "", manufacturer: "", stockLevel: "" });

  useEffect(() => {
    api.listStock().then((d) => setStock(d.stock)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const categories = [...new Set(stock.map((item) => item.category).filter(Boolean))].sort();
  const manufacturers = [...new Set(stock.map((item) => item.manufacturer).filter(Boolean))].sort();
  const filtered = stock.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(appliedFilters.search.toLowerCase());
    const matchesBatch = !appliedFilters.batch || (s.batch || "").toLowerCase().includes(appliedFilters.batch.toLowerCase());
    const matchesCategory = !appliedFilters.category || s.category === appliedFilters.category;
    const matchesManufacturer = !appliedFilters.manufacturer || s.manufacturer === appliedFilters.manufacturer;
    const matchesStockLevel = !appliedFilters.stockLevel || (appliedFilters.stockLevel === "low" ? s.qty > 0 && s.qty <= 10 : appliedFilters.stockLevel === "out" ? s.qty <= 0 : s.qty > 10);
    return matchesSearch && matchesBatch && matchesCategory && matchesManufacturer && matchesStockLevel;
  });
  const products = Object.values(filtered.reduce((grouped, item) => {
    if (!grouped[item.skuId]) {
      grouped[item.skuId] = { ...item, qty: 0, batches: [] };
    }
    grouped[item.skuId].qty += Number(item.qty) || 0;
    grouped[item.skuId].batches.push(item);
    return grouped;
  }, {}));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Stock On Hand</h1>

        <Link
          href="/inventory/history/all"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          View All Transactions History
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <input placeholder="Search SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:w-64" />
        <input placeholder="Batch" value={batch} onChange={(e) => setBatch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:w-40" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">All categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">All manufacturers</option>
          {manufacturers.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={stockLevel} onChange={(e) => setStockLevel(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">All stock levels</option>
          <option value="low">Low stock (1-10)</option>
          <option value="healthy">Healthy stock (11+)</option>
          <option value="out">Out of stock</option>
        </select>
        <button type="button" onClick={() => setAppliedFilters({ search, batch, category, manufacturer, stockLevel })} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white">Filter</button>
        <button type="button" onClick={() => { setSearch(""); setBatch(""); setCategory(""); setManufacturer(""); setStockLevel(""); setAppliedFilters({ search: "", batch: "", category: "", manufacturer: "", stockLevel: "" }); }} className="px-1 py-2 text-sm text-gray-600 hover:text-gray-900 hover:underline">Clear Filters</button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-gray-500">No stock to show.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Sub Category</th>
                <th className="px-4 py-2">Product Name</th>
                <th className="px-4 py-2">Manufacturer</th>
                <th className="px-4 py-2">Rate</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">UOM</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((s) => (
                <Fragment key={s.skuId}>
                  <tr className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2">{s.category || "-"}</td>
                    <td className="px-4 py-2">{s.subCategory || "-"}</td>
                    <td className="px-4 py-2 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-2">{s.manufacturer || "-"}</td>
                    <td className="px-4 py-2">{s.rate == null ? "-" : `₹${Number(s.rate).toFixed(2)}`}</td>
                    <td className={`px-4 py-2 font-medium ${s.qty === 0 ? "text-red-500" : ""}`}>{s.qty}</td>
                    <td className="px-4 py-2">{s.uom}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/inventory/history/${s.skuId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Transaction History
                      </Link>
                    </td>
                  </tr>
                  <tr className="border-t border-gray-100">
                    <td colSpan="8" className="px-4 py-2">
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-800">Show Details</summary>
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full min-w-[28rem] text-xs text-gray-600">
                            <thead className="bg-gray-50 text-left">
                              <tr>
                                <th className="px-3 py-2 font-medium">Batch</th>
                                <th className="px-3 py-2 font-medium">Exp</th>
                                <th className="px-3 py-2 font-medium">MRP</th>
                                <th className="px-3 py-2 font-medium">Qty</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.batches.map((batch) => (
                                <tr key={`${batch.batch}-${batch.expiryDate}-${batch.mrp}`} className="border-t border-gray-100">
                                  <td className="px-3 py-2 font-medium text-gray-900">{batch.batch || "-"}</td>
                                  <td className="px-3 py-2">{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : "-"}</td>
                                  <td className="px-3 py-2">{batch.mrp == null ? "-" : `₹${Number(batch.mrp).toFixed(2)}`}</td>
                                  <td className="px-3 py-2 font-medium">{batch.qty}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
