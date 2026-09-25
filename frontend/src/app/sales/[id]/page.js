"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { user, token, showToast } = useApp();
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState("");
  const [lastPrinted, setLastPrinted] = useState(null);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    api.getInvoice(id).then((d) => setInvoice(d.invoice)).catch((e) => setError(e.message));
    const printedInfo = localStorage.getItem(`printed_sales_${id}`);
    if (printedInfo) {
      try {
        setLastPrinted(JSON.parse(printedInfo));
      } catch (e) {
        // ignore parse error
      }
    }
  }, [id]);

  function handlePrint() {
    const printData = {
      printedBy: user?.name || "System User",
      printedAt: new Date().toISOString(),
    };
    setLastPrinted(printData);
    localStorage.setItem(`printed_sales_${id}`, JSON.stringify(printData));
    setTimeout(() => {
      window.print();
    }, 100);
  }

  async function handleConfirm() {
    try {
      const data = await api.confirmInvoice(id, token);
      setInvoice(data.invoice);
      showToast("Invoice confirmed and inventory updated.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const data = await api.duplicateInvoice(id, token);
      showToast("Invoice duplicated successfully.");
      window.location.href = `/sales/${data.invoice._id}`;
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setDuplicating(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this draft invoice?")) return;
    try {
      await api.deleteInvoice(id, token);
      showToast("Invoice deleted.");
      window.location.href = "/sales";
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!invoice) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="w-full space-y-6 print:p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Invoice {invoice.invoiceNumber}</h1>
        </div>
        <div className="no-print flex items-center gap-2">
          <button type="button" onClick={handleDuplicate} disabled={duplicating} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">{duplicating ? "Duplicating..." : "Duplicate"}</button>
          {invoice.status === "draft" && <a href={`/sales/new?edit=${invoice._id}`} className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">Edit</a>}
          {invoice.status === "draft" && <button type="button" onClick={handleDelete} className="rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Delete</button>}
          {invoice.status === "draft" && <button type="button" onClick={handleConfirm} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">Confirm Invoice</button>}
          {invoice.status === "confirmed" && <a href={`/sales/returns/new?invoiceId=${invoice._id}`} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">Sales Return</a>}
          <button onClick={handlePrint} type="button" className="inline-flex items-center gap-2 rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / PDF
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">Status: {invoice.status}</p>

      {lastPrinted && (
        <div className="text-xs text-gray-500 border-b border-gray-100 pb-2">
          Last printed by: <span className="font-medium text-gray-700">{lastPrinted.printedBy}</span> at{" "}
          <span className="font-medium text-gray-700">{new Date(lastPrinted.printedAt).toLocaleString()}</span>
        </div>
      )}

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

      <div className="border border-gray-200 rounded-lg p-4 bg-white grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div className="sm:col-span-4">
          <div className="text-gray-500 text-xs">Linked Sales Return</div>
          {invoice.linkedSalesReturns?.length ? (
            <div className="flex flex-wrap gap-x-2">
              {invoice.linkedSalesReturns.map((note) => (
                <a key={note._id} href={`/sales/returns/${note._id}`} className="text-violet-700 hover:underline">{note.creditNoteNumber}</a>
              ))}
            </div>
          ) : "-"}
        </div>
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
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td className="px-4 py-2 text-right">₹{invoice.totalAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan="7" className="px-4 py-1 text-right">GST</td>
              <td className="px-4 py-1 text-right">₹{Number(invoice.gstAmount || 0).toFixed(2)}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan="7" className="px-4 py-1 text-right">Grand total</td>
              <td className="px-4 py-1 text-right">₹{Number(invoice.grandTotal ?? invoice.totalAmount).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
