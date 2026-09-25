"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function DebitNoteDetailPage() {
  const { id } = useParams();
  const [debitNote, setDebitNote] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getDebitNote(id)
      .then((d) => setDebitNote(d.debitNote))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-sm text-red-600 p-4">{error}</p>;
  if (!debitNote) return <p className="text-sm text-gray-500 p-4">Loading Debit Note...</p>;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{debitNote.debitNoteNumber}</h1>
          <p className="text-sm text-gray-500">Debit Note / Purchase Return</p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-gray-800 text-white hover:bg-gray-900 font-medium px-4 py-2 text-sm rounded-lg shadow-sm transition"
        >
          Print Debit Note
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm shadow-sm">
        <div><div className="text-gray-500 text-xs">Debit Note #</div><span className="font-medium">{debitNote.debitNoteNumber}</span></div>
        <div><div className="text-gray-500 text-xs">Return Date</div>{new Date(debitNote.returnDate).toLocaleDateString()}</div>
        <div><div className="text-gray-500 text-xs">GRN #</div>{debitNote.grnNumber}</div>
        <div><div className="text-gray-500 text-xs">Supplier Name</div>{debitNote.supplierName}</div>
        <div><div className="text-gray-500 text-xs">Created By</div>{debitNote.createdBy?.name || "-"}</div>
        <div><div className="text-gray-500 text-xs">Reason for Return</div>{debitNote.reason || "N/A"}</div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">SKU Name</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Expiry Date</th>
              <th className="px-4 py-3">Return Qty</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">GST Rate</th>
              <th className="px-4 py-3">GST Amount</th>
              <th className="px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {debitNote.items.map((item, idx) => (
              <tr key={idx}>
                <td className="px-4 py-3 font-medium text-gray-900">{item.skuName}</td>
                <td className="px-4 py-3 text-gray-600">{item.batch}</td>
                <td className="px-4 py-3 text-gray-600">{new Date(item.expiryDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-gray-900 font-medium">{item.qty}</td>
                <td className="px-4 py-3 text-gray-600">₹{item.rate.toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-600">{item.gstRate || 0}%</td>
                <td className="px-4 py-3 text-gray-600">₹{(item.gstAmount || 0).toFixed(2)}</td>
                <td className="px-4 py-3 font-medium text-gray-900">₹{item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-gray-200 bg-gray-50 font-medium">
            <tr>
              <td colSpan="3" className="px-4 py-2 text-right">Total Qty:</td>
              <td className="px-4 py-2">{debitNote.totalQty}</td>
              <td colSpan="3" className="px-4 py-2 text-right">Total Amount:</td>
              <td className="px-4 py-2">₹{debitNote.totalAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan="7" className="px-4 py-1 text-right text-gray-600">GST Amount:</td>
              <td className="px-4 py-1 text-gray-600">₹{(debitNote.gstAmount || 0).toFixed(2)}</td>
            </tr>
            <tr className="font-semibold text-gray-900 border-t border-gray-200">
              <td colSpan="7" className="px-4 py-2 text-right">Grand Total:</td>
              <td className="px-4 py-2">₹{(debitNote.grandTotal || debitNote.totalAmount).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
