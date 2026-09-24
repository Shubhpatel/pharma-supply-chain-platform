"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getInvoice(id).then((d) => setInvoice(d.invoice)).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!invoice) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold">Invoice {invoice.invoiceNumber}</h1>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-gray-800 text-white hover:bg-gray-900 font-medium px-4 py-2 text-sm rounded-lg shadow-sm transition"
        >
          Print Invoice
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div><div className="text-gray-500 text-xs">Customer</div>{invoice.customerName}</div>
        <div><div className="text-gray-500 text-xs">Sale date</div>{new Date(invoice.saleDate).toLocaleDateString()}</div>
        <div><div className="text-gray-500 text-xs">Created by</div>{invoice.createdBy?.name || "-"}</div>
        {invoice.customer && (
          <div className="col-span-2 sm:col-span-3 border-t border-gray-100 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><div className="text-gray-500 text-xs">Customer GST</div>{invoice.customer.gstNumber || "-"}</div>
            <div><div className="text-gray-500 text-xs">Contact person</div>{invoice.customer.contactPerson || "-"}</div>
            <div><div className="text-gray-500 text-xs">Phone / email</div>{[invoice.customer.phone, invoice.customer.email].filter(Boolean).join(" / ") || "-"}</div>
            <div><div className="text-gray-500 text-xs">Address</div>{[invoice.customer.addressLine1, invoice.customer.addressLine2, invoice.customer.city, invoice.customer.state, invoice.customer.postalCode].filter(Boolean).join(", ") || "-"}</div>
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2">Batch</th>
              <th className="px-4 py-2">Expiry</th>
              <th className="px-4 py-2">MRP</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2">GST</th>
              <th className="px-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-2">{item.skuName}</td>
                <td className="px-4 py-2">{item.batch}</td>
                <td className="px-4 py-2">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "-"}</td>
                <td className="px-4 py-2">₹{Number(item.mrp || 0).toFixed(2)}</td>
                <td className="px-4 py-2">{item.qty}</td>
                <td className="px-4 py-2">₹{Number(item.rate || 0).toFixed(2)}</td>
                <td className="px-4 py-2">{item.gstRate || 0}%</td>
                <td className="px-4 py-2">₹{Number(item.amount || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 font-medium">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2">{invoice.totalQty}</td>
              <td></td>
              <td className="px-4 py-2">₹{invoice.totalAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan="7" className="px-4 py-1 text-right">GST</td>
              <td className="px-4 py-1">₹{Number(invoice.gstAmount || 0).toFixed(2)}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan="6" className="px-4 py-1 text-right">Grand total</td>
              <td className="px-4 py-1">₹{Number(invoice.grandTotal ?? invoice.totalAmount).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
