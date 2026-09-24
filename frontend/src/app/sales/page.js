"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function SalesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ search: "", fromDate: "", toDate: "" });

  useEffect(() => {
    api.listInvoices().then((d) => setInvoices(d.invoices)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const filteredInvoices = invoices.filter((invoice) => {
    const query = appliedFilters.search.toLowerCase();
    const saleDate = new Date(invoice.saleDate);
    const matchesSearch = !query || [invoice.invoiceNumber, invoice.customerName].some((value) => value.toLowerCase().includes(query));
    const matchesFrom = !appliedFilters.fromDate || saleDate >= new Date(`${appliedFilters.fromDate}T00:00:00`);
    const matchesTo = !appliedFilters.toDate || saleDate <= new Date(`${appliedFilters.toDate}T23:59:59.999`);
    return matchesSearch && matchesFrom && matchesTo;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sales</h1>
        <a href="/sales/new" className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium">+ Add Invoice</a>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <input placeholder="Search invoice or customer" value={search} onChange={(e) => setSearch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:w-72" />
        <fieldset className="flex items-center gap-2 border border-gray-300 rounded-md px-2 py-1">
          <legend className="px-1 text-xs text-gray-500">Sale date</legend>
          <input type="date" aria-label="Sale date from" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-1 py-1 text-sm" />
          <span className="text-sm text-gray-400">to</span>
          <input type="date" aria-label="Sale date to" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-1 py-1 text-sm" />
        </fieldset>
        <button type="button" onClick={() => setAppliedFilters({ search, fromDate, toDate })} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white">Filter</button>
        <button type="button" onClick={() => { setSearch(""); setFromDate(""); setToDate(""); setAppliedFilters({ search: "", fromDate: "", toDate: "" }); }} className="px-1 py-2 text-sm text-gray-600 hover:text-gray-900 hover:underline">Clear Filters</button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : filteredInvoices.length === 0 ? (
        <p className="text-sm text-gray-500">{invoices.length === 0 ? "No invoices yet." : "No invoices match the filters."}</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Invoice Number</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Sale Date</th>
                <th className="px-4 py-2">Total Qty</th>
                <th className="px-4 py-2">Total Amount</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => (
                <tr key={inv._id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2">{inv.customerName}</td>
                  <td className="px-4 py-2">{new Date(inv.saleDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{inv.totalQty}</td>
                  <td className="px-4 py-2">₹{inv.totalAmount.toFixed(2)}</td>
                  <td className="px-4 py-2"><a href={`/sales/${inv._id}`} className="text-blue-600 hover:underline">View</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
