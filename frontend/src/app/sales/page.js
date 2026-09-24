"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function SalesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listInvoices().then((d) => setInvoices(d.invoices)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sales</h1>
        <a href="/sales/new" className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium">+ Add Invoice</a>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : invoices.length === 0 ? (
        <p className="text-sm text-gray-500">No invoices yet.</p>
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
              {invoices.map((inv) => (
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
