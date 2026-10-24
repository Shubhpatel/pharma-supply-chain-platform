"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import PaginationControls from "@/components/PaginationControls";

export default function SalesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ search: "", fromDate: "", toDate: "" });
  const [duplicatingId, setDuplicatingId] = useState("");
  const { token, showToast } = useApp();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.listInvoices(token, { page, limit }).then((d) => {
      setInvoices(d.invoices || []);
      setTotal(d.pagination?.total || 0);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [token, page, limit]);

  async function handleDuplicate(id) {
    setDuplicatingId(id);
    try {
      const data = await api.duplicateInvoice(id, token);
      showToast("Invoice duplicated successfully.");
      window.location.href = `/sales/${data.invoice._id}`;
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setDuplicatingId("");
    }
  }

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

      <div className="flex flex-wrap items-center gap-3">
        <input placeholder="Search invoice or customer" value={search} onChange={(e) => setSearch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:w-72" />
        <fieldset className="filter-fieldset">
          <legend>Sale date</legend>
          <input type="date" aria-label="Sale date from" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <span className="text-xs text-gray-400">—</span>
          <input type="date" aria-label="Sale date to" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </fieldset>
        <button type="button" onClick={() => setAppliedFilters({ search, fromDate, toDate })} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white">Filter</button>
        <button type="button" onClick={() => { setSearch(""); setFromDate(""); setToDate(""); setAppliedFilters({ search: "", fromDate: "", toDate: "" }); }} className="text-sm text-gray-500 hover:text-gray-800 hover:underline">Clear</button>
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
                <th className="px-4 py-2 text-right">Total Qty</th>
                <th className="px-4 py-2 text-right">Total Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => (
                <tr key={inv._id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2">{inv.customerName}</td>
                  <td className="px-4 py-2">{new Date(inv.saleDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{inv.totalQty}</td>
                  <td className="px-4 py-2 text-right tabular-nums">₹{inv.totalAmount.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className={`status-badge status-${inv.status}`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <a href={`/sales/${inv._id}`} title="View invoice" aria-label="View invoice" className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900">
                        <img src="/icons/view.svg" alt="" className="h-3.5 w-3.5" />
                        View
                      </a>
                      <button type="button" onClick={() => handleDuplicate(inv._id)} disabled={duplicatingId === inv._id} className="text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-40">
                        {duplicatingId === inv._id ? "Duplicating…" : "Duplicate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PaginationControls page={page} limit={limit} total={total} onPageChange={setPage} onLimitChange={(size) => { setLimit(size); setPage(1); }} />
    </div>
  );
}
