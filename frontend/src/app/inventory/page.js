"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function InventoryPage() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.listStock().then((d) => setStock(d.stock)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const filtered = stock.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Stock On Hand</h1>

      <input placeholder="Search SKU" value={search} onChange={(e) => setSearch(e.target.value)}
        className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:w-80" />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
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
                <th className="px-4 py-2">Batch</th>
                <th className="px-4 py-2">Expiry</th>
                <th className="px-4 py-2">MRP</th>
                <th className="px-4 py-2">Rate</th>
                <th className="px-4 py-2">Qty</th>
                <th className="px-4 py-2">UOM</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.skuId} className="border-t border-gray-100">
                  <td className="px-4 py-2">{s.category || "-"}</td>
                  <td className="px-4 py-2">{s.subCategory || "-"}</td>
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2">{s.manufacturer || "-"}</td>
                  <td className="px-4 py-2">{s.batch}</td>
                  <td className="px-4 py-2">{s.expiryDate ? new Date(s.expiryDate).toLocaleDateString() : "-"}</td>
                  <td className="px-4 py-2">{s.mrp == null ? "-" : `₹${Number(s.mrp).toFixed(2)}`}</td>
                  <td className="px-4 py-2">{s.rate == null ? "-" : `₹${Number(s.rate).toFixed(2)}`}</td>
                  <td className={`px-4 py-2 font-medium ${s.qty === 0 ? "text-red-500" : ""}`}>{s.qty}</td>
                  <td className="px-4 py-2">{s.uom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
