"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function GrnPage() {
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ search: "", fromDate: "", toDate: "" });

  useEffect(() => {
    api.listGrns().then((d) => setGrns(d.grns)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const filteredGrns = grns.filter((grn) => {
    const query = appliedFilters.search.toLowerCase();
    const grnDate = new Date(grn.grnDate);
    const matchesSearch = !query || [grn.grnNumber, grn.poNumber, grn.supplierName].some((value) => value.toLowerCase().includes(query));
    const matchesFrom = !appliedFilters.fromDate || grnDate >= new Date(`${appliedFilters.fromDate}T00:00:00`);
    const matchesTo = !appliedFilters.toDate || grnDate <= new Date(`${appliedFilters.toDate}T23:59:59.999`);
    return matchesSearch && matchesFrom && matchesTo;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">GRN</h1>
        <a href="/grn/new" className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium">+ Add GRN</a>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <input placeholder="Search GRN, PO or supplier" value={search} onChange={(e) => setSearch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:w-72" />
        <fieldset className="filter-fieldset">
          <legend>GRN date</legend>
          <input type="date" aria-label="GRN date from" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <span className="text-xs text-gray-400">—</span>
          <input type="date" aria-label="GRN date to" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </fieldset>
        <button type="button" onClick={() => setAppliedFilters({ search, fromDate, toDate })} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white">Filter</button>
        <button type="button" onClick={() => { setSearch(""); setFromDate(""); setToDate(""); setAppliedFilters({ search: "", fromDate: "", toDate: "" }); }} className="text-sm text-gray-500 hover:text-gray-800 hover:underline">Clear</button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : filteredGrns.length === 0 ? (
        <p className="text-sm text-gray-500">{grns.length === 0 ? "No GRNs yet." : "No GRNs match the filters."}</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">GRN Number</th>
                <th className="px-4 py-2">PO Number</th>
                <th className="px-4 py-2">Supplier</th>
                <th className="px-4 py-2">GRN Date</th>
                <th className="px-4 py-2 text-right">Total Qty</th>
                <th className="px-4 py-2 text-right">Total Value</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredGrns.map((g) => (
                <tr key={g._id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{g.grnNumber}</td>
                  <td className="px-4 py-2">{g.poNumber}</td>
                  <td className="px-4 py-2">{g.supplierName}</td>
                  <td className="px-4 py-2">{new Date(g.grnDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{g.totalQty}</td>
                  <td className="px-4 py-2 text-right tabular-nums">₹{g.totalValue.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className={`status-badge status-${g.status}`}>{g.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    <a href={`/grn/${g._id}`} title="View GRN" aria-label="View GRN" className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900">
                      <img src="/icons/view.svg" alt="" className="h-3.5 w-3.5" />
                      View
                    </a>
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
