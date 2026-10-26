"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";

export default function DebitNoteDetailPage() {
  const { id } = useParams();
  const [debitNote, setDebitNote] = useState(null);
  const [error, setError] = useState("");
  const { token, user, showToast } = useApp();

  async function handleDelete() {
    if (!window.confirm("Delete this draft debit note?")) return;
    try {
      await api.deleteDebitNote(id, token);
      showToast("Debit note deleted.");
      window.location.href = "/purchase/returns";
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  useEffect(() => {
    api.getDebitNote(id)
      .then((d) => setDebitNote(d.debitNote))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-sm text-red-600 p-4">{error}</p>;
  if (!debitNote) return <p className="text-sm text-gray-500 p-4">Loading Debit Note...</p>;

  async function handleDownloadPdf() {
    try {
      await api.downloadPdf(`/debit-notes/${id}/pdf`, `${debitNote.debitNoteNumber || "DN"}.pdf`, token);
      showToast("PDF downloaded successfully.");
    } catch (err) {
      showToast(err.message || "Failed to download PDF", "error");
    }
  }

  async function handleConfirm() {
    try {
      const data = await api.confirmDebitNote(id, token);
      setDebitNote(data.debitNote);
      showToast("Debit note confirmed and inventory updated.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{debitNote.debitNoteNumber}</h1>
          <p className="text-sm text-gray-500">Debit Note / Purchase Return</p>
        </div>
        <div className="flex gap-2">
          {(debitNote.status === "draft" || user?.role === "ADMIN") && <a href={`/purchase/returns/new?edit=${debitNote._id}`} className="bg-blue-600 text-white hover:bg-blue-700 font-medium px-4 py-2 text-sm rounded-lg">Edit</a>}
          {(debitNote.status === "draft" || user?.role === "ADMIN") && <button onClick={handleDelete} className="border border-red-600 text-red-700 hover:bg-red-50 font-medium px-4 py-2 text-sm rounded-lg">Delete</button>}
          {debitNote.status === "draft" && <button onClick={handleConfirm} className="bg-teal-700 text-white hover:bg-teal-800 font-medium px-4 py-2 text-sm rounded-lg">Confirm</button>}
          <button onClick={handleDownloadPdf} className="bg-teal-700 text-white hover:bg-teal-800 font-medium px-4 py-2 text-sm rounded-lg shadow-sm transition">Download PDF</button>
          <button onClick={() => window.print()} className="bg-gray-800 text-white hover:bg-gray-900 font-medium px-4 py-2 text-sm rounded-lg shadow-sm transition">Print Debit Note</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 rounded-lg border border-gray-200 bg-white p-5 text-sm shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><div className="info-label">Debit Note #</div><div className="info-value">{debitNote.debitNoteNumber}</div></div>
        <div><div className="info-label">Return Date</div><div className="info-value">{new Date(debitNote.returnDate).toLocaleDateString()}</div></div>
        <div><div className="info-label">GRN #</div><div className="info-value">{debitNote.grnNumber}</div></div>
        <div><div className="info-label">Supplier Name</div><div className="info-value">{debitNote.supplierName}</div></div>
        <div><div className="info-label">Created By</div><div className="info-value">{debitNote.createdBy?.name || "-"}</div></div>
        <div><div className="info-label">Reason for Return</div><div className="info-value">{debitNote.reason || "N/A"}</div></div>
        <div><div className="info-label">Status</div><div className="info-value capitalize">{debitNote.status}</div></div>
        {debitNote.supplier && (
          <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><div className="info-label">Vendor GST</div><div className="info-value">{debitNote.supplier.gstNumber || "-"}</div></div>
            <div><div className="info-label">Contact person</div><div className="info-value">{debitNote.supplier.contactPerson || "-"}</div></div>
            <div><div className="info-label">Phone / email</div><div className="info-value">{[debitNote.supplier.phone, debitNote.supplier.email].filter(Boolean).join(" / ") || "-"}</div></div>
            <div><div className="info-label">Address</div><div className="info-value">{[debitNote.supplier.addressLine1, debitNote.supplier.addressLine2, debitNote.supplier.city, debitNote.supplier.state, debitNote.supplier.postalCode].filter(Boolean).join(", ") || "-"}</div></div>
          </div>
        )}
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
            {debitNote.items.map((item, idx) => (
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
              <td className="px-4 py-2 text-right tabular-nums">{debitNote.totalQty}</td>
              <td colSpan="3" className="px-4 py-2 text-right">Total Amount:</td>
              <td className="px-4 py-2 text-right tabular-nums">₹{debitNote.totalAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan="7" className="px-4 py-1 text-right text-gray-600">GST Amount:</td>
              <td className="px-4 py-1 text-right text-gray-600">₹{(debitNote.gstAmount || 0).toFixed(2)}</td>
            </tr>
            <tr className="font-semibold text-gray-900 border-t border-gray-200">
              <td colSpan="7" className="px-4 py-2 text-right">Grand Total:</td>
              <td className="px-4 py-2 text-right">₹{(debitNote.grandTotal || debitNote.totalAmount).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </div>
  );
}
