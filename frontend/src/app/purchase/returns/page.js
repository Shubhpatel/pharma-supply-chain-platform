"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function DebitNoteListPage() {
  const [debitNotes, setDebitNotes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listDebitNotes()
      .then((d) => setDebitNotes(d.debitNotes || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = debitNotes.filter((dn) => {
    const q = search.toLowerCase();
    return (
      dn.debitNoteNumber.toLowerCase().includes(q) ||
      dn.grnNumber.toLowerCase().includes(q) ||
      dn.supplierName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Purchase Returns (Debit Notes)</h1>
          <p className="text-sm text-gray-500">Manage goods returned to suppliers against GRNs</p>
        </div>
        <a
          href="/purchase/returns/new"
          className="bg-teal-700 text-white hover:bg-teal-800 font-medium px-4 py-2 text-sm rounded-lg shadow-sm transition"
        >
          Create Debit Note
        </a>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <input
          type="text"
          placeholder="Filter by Debit Note #, GRN #, or Supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
        />
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500 font-medium border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">Debit Note #</th>
              <th className="px-4 py-3">GRN #</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Return Date</th>
              <th className="px-4 py-3 text-right">Total Qty</th>
              <th className="px-4 py-3 text-right">Total Amount</th>
              <th className="px-4 py-3 text-right">GST</th>
              <th className="px-4 py-3 text-right">Grand Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="10" className="p-4 text-center text-gray-500">Loading debit notes...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="10" className="p-4 text-center text-gray-500">No debit notes found.</td></tr>
            ) : (
              filtered.map((dn) => (
                <tr key={dn._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{dn.debitNoteNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{dn.grnNumber}</td>
                  <td className="px-4 py-3 text-gray-900">{dn.supplierName}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(dn.returnDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">{dn.totalQty}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">₹{(dn.totalAmount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">₹{(dn.gstAmount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">₹{(dn.grandTotal || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge status-${dn.status}`}>{dn.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/purchase/returns/${dn._id}`} title="View debit note" aria-label="View debit note" className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900">
                      <img src="/icons/view.svg" alt="" className="h-3.5 w-3.5" />
                      View
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
