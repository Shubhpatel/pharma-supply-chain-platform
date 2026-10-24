"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";

export default function CreditNoteDetailPage() {
  const { id } = useParams();
  const [creditNote, setCreditNote] = useState(null);
  const [error, setError] = useState("");
  const { token, user, showToast } = useApp();

  async function handleDelete() {
    if (!window.confirm("Delete this draft credit note?")) return;
    try {
      await api.deleteCreditNote(id, token);
      showToast("Credit note deleted.");
      window.location.href = "/sales/returns";
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  useEffect(() => {
    api.getCreditNote(id)
      .then((d) => setCreditNote(d.creditNote))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-sm text-red-600 p-4">{error}</p>;
  if (!creditNote) return <p className="text-sm text-gray-500 p-4">Loading Credit Note...</p>;

  async function handleConfirm() {
    try {
      const data = await api.confirmCreditNote(id, token);
      setCreditNote(data.creditNote);
      showToast("Credit note confirmed and inventory updated.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{creditNote.creditNoteNumber}</h1>
          <p className="text-sm text-gray-500">Credit Note / Sales Return</p>
        </div>
        <div className="flex gap-2">
          {(creditNote.status === "draft" || user?.role === "ADMIN") && <a href={`/sales/returns/new?edit=${creditNote._id}`} className="bg-blue-600 text-white hover:bg-blue-700 font-medium px-4 py-2 text-sm rounded-lg">Edit</a>}
          {(creditNote.status === "draft" || user?.role === "ADMIN") && <button onClick={handleDelete} className="border border-red-600 text-red-700 hover:bg-red-50 font-medium px-4 py-2 text-sm rounded-lg">Delete</button>}
          {creditNote.status === "draft" && <button onClick={handleConfirm} className="bg-teal-700 text-white hover:bg-teal-800 font-medium px-4 py-2 text-sm rounded-lg">Confirm</button>}
          <button onClick={() => window.print()} className="bg-gray-800 text-white hover:bg-gray-900 font-medium px-4 py-2 text-sm rounded-lg shadow-sm transition">Print Credit Note</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 rounded-lg border border-gray-200 bg-white p-5 text-sm shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><div className="info-label">Credit Note #</div><div className="info-value">{creditNote.creditNoteNumber}</div></div>
        <div><div className="info-label">Return Date</div><div className="info-value">{new Date(creditNote.returnDate).toLocaleDateString()}</div></div>
        <div><div className="info-label">Invoice #</div><div className="info-value">{creditNote.invoiceNumber}</div></div>
        <div><div className="info-label">Customer Name</div><div className="info-value">{creditNote.customerName}</div></div>
        <div><div className="info-label">Created By</div><div className="info-value">{creditNote.createdBy?.name || "-"}</div></div>
        <div><div className="info-label">Reason for Return</div><div className="info-value">{creditNote.reason || "N/A"}</div></div>
        <div><div className="info-label">Status</div><div className="info-value capitalize">{creditNote.status}</div></div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] table-fixed text-sm">
          <colgroup>
            <col className="w-[22%]" /><col className="w-[14%]" /><col className="w-[14%]" />
            <col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[10%]" />
            <col className="w-[10%]" /><col className="w-[10%]" />
          </colgroup>
          <thead className="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">SKU Name</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Expiry Date</th>
              <th className="px-4 py-3 text-right">Return Qty</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">GST Rate</th>
              <th className="px-4 py-3 text-right">GST Amount</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {creditNote.items.map((item, idx) => (
              <tr key={idx}>
                <td className="truncate px-4 py-3 font-medium text-gray-900">{item.skuName}</td>
                <td className="truncate px-4 py-3 text-gray-600">{item.batch}</td>
                <td className="px-4 py-3 text-gray-600">{new Date(item.expiryDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">{item.qty}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600">₹{item.rate.toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600">{item.gstRate || 0}%</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600">₹{(item.gstAmount || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-900">₹{item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-gray-200 bg-gray-50 font-medium">
            <tr>
              <td colSpan="3" className="px-4 py-2 text-right">Total Qty:</td>
              <td className="px-4 py-2 text-right tabular-nums">{creditNote.totalQty}</td>
              <td colSpan="3" className="px-4 py-2 text-right">Total Amount:</td>
              <td className="px-4 py-2 text-right tabular-nums">₹{creditNote.totalAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan="7" className="px-4 py-1 text-right text-gray-600">GST Amount:</td>
              <td className="px-4 py-1 text-right text-gray-600">₹{(creditNote.gstAmount || 0).toFixed(2)}</td>
            </tr>
            <tr className="font-semibold text-gray-900 border-t border-gray-200">
              <td colSpan="7" className="px-4 py-2 text-right">Grand Total:</td>
              <td className="px-4 py-2 text-right">₹{(creditNote.grandTotal || creditNote.totalAmount).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </div>
  );
}
