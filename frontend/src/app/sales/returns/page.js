"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function CreditNoteListPage() {
  const [creditNotes, setCreditNotes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listCreditNotes()
      .then((d) => setCreditNotes(d.creditNotes || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = creditNotes.filter((cn) => {
    const q = search.toLowerCase();
    return (
      cn.creditNoteNumber.toLowerCase().includes(q) ||
      cn.invoiceNumber.toLowerCase().includes(q) ||
      cn.customerName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sales Returns (Credit Notes)</h1>
          <p className="text-sm text-gray-500">Manage goods returned by customers against Sales Invoices</p>
        </div>
        <a
          href="/sales/returns/new"
          className="bg-teal-700 text-white hover:bg-teal-800 font-medium px-4 py-2 text-sm rounded-lg shadow-sm transition"
        >
          Create Credit Note
        </a>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <input
          type="text"
          placeholder="Filter by Credit Note #, Invoice #, or Customer..."
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
              <th className="px-4 py-3">Credit Note #</th>
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Customer</th>
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
              <tr><td colSpan="10" className="p-4 text-center text-gray-500">Loading credit notes...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="10" className="p-4 text-center text-gray-500">No credit notes found.</td></tr>
            ) : (
              filtered.map((cn) => (
                <tr key={cn._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{cn.creditNoteNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{cn.invoiceNumber}</td>
                  <td className="px-4 py-3 text-gray-900">{cn.customerName}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(cn.returnDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">{cn.totalQty}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">₹{(cn.totalAmount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">₹{(cn.gstAmount || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">₹{(cn.grandTotal || 0).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge status-${cn.status}`}>{cn.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/sales/returns/${cn._id}`} title="View credit note" aria-label="View credit note" className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900">
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
