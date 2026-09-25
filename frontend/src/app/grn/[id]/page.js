"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";

export default function GrnDetailPage() {
  const { id } = useParams();
  const { user, token, showToast } = useApp();
  const [grn, setGrn] = useState(null);
  const [error, setError] = useState("");
  const [lastPrinted, setLastPrinted] = useState(null);

  useEffect(() => {
    api.getGrn(id).then((d) => setGrn(d.grn)).catch((e) => setError(e.message));
    const printedInfo = localStorage.getItem(`printed_grn_${id}`);
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
    localStorage.setItem(`printed_grn_${id}`, JSON.stringify(printData));
    setTimeout(() => {
      window.print();
    }, 100);
  }

  async function handleConfirm() {
    try {
      const data = await api.confirmGrn(id, token);
      setGrn(data.grn);
      showToast("GRN confirmed and inventory updated.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this draft GRN?")) return;
    try {
      await api.deleteGrn(id, token);
      showToast("GRN deleted.");
      window.location.href = "/grn";
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!grn) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="w-full space-y-6 print:p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{grn.grnNumber}</h1>
          <p className="text-sm text-gray-500">
            Against PO {grn.purchaseOrder?._id ? (
              <a href={`/purchase/${grn.purchaseOrder._id}`} className="text-blue-600 hover:underline">
                {grn.purchaseOrder.poNumber}
              </a>
            ) : grn.poNumber}
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          {(grn.status === "draft" || user?.role === "ADMIN") && <a href={`/grn/new?edit=${grn._id}`} className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">Edit</a>}
          {(grn.status === "draft" || user?.role === "ADMIN") && <button type="button" onClick={handleDelete} className="rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Delete</button>}
          {grn.status === "draft" && <button type="button" onClick={handleConfirm} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">Confirm GRN</button>}
          {grn.status === "confirmed" && <a href={`/purchase/returns/new?grnId=${grn._id}`} className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">Purchase Return</a>}
          <button onClick={handlePrint} type="button" className="inline-flex items-center gap-2 rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / PDF
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500">Status: {grn.status}</p>

      {lastPrinted && (
        <div className="text-xs text-gray-500 border-b border-gray-100 pb-2">
          Last printed by: <span className="font-medium text-gray-700">{lastPrinted.printedBy}</span> at{" "}
          <span className="font-medium text-gray-700">{new Date(lastPrinted.printedAt).toLocaleString()}</span>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-4 bg-white grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div><div className="text-gray-500 text-xs">Supplier</div>{grn.supplierName}</div>
        <div><div className="text-gray-500 text-xs">GRN date</div>{new Date(grn.grnDate).toLocaleDateString()}</div>
        <div><div className="text-gray-500 text-xs">Purchase invoice number</div>{grn.purchaseInvoiceNumber}</div>
        <div><div className="text-gray-500 text-xs">Purchase invoice date</div>{new Date(grn.purchaseInvoiceDate).toLocaleDateString()}</div>
        <div><div className="text-gray-500 text-xs">Created by</div>{grn.createdBy?.name || "-"}</div>
        <div><div className="text-gray-500 text-xs">Last updated by</div>{grn.createdBy?.name || "-"}</div>
        <div><div className="text-gray-500 text-xs">Last updated at</div>{grn.updatedAt ? new Date(grn.updatedAt).toLocaleString() : "-"}</div>
        {grn.supplier && (
          <div className="sm:col-span-4 border-t border-gray-100 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><div className="text-gray-500 text-xs">Supplier GST</div>{grn.supplier.gstNumber || "-"}</div>
            <div><div className="text-gray-500 text-xs">Contact person</div>{grn.supplier.contactPerson || "-"}</div>
            <div><div className="text-gray-500 text-xs">Phone / email</div>{[grn.supplier.phone, grn.supplier.email].filter(Boolean).join(" / ") || "-"}</div>
            <div><div className="text-gray-500 text-xs">Address</div>{[grn.supplier.addressLine1, grn.supplier.addressLine2, grn.supplier.city, grn.supplier.state, grn.supplier.postalCode].filter(Boolean).join(", ") || "-"}</div>
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div className="sm:col-span-4">
          <div className="text-gray-500 text-xs">Linked Purchase Return</div>
          {grn.linkedPurchaseReturns?.length ? (
            <div className="flex flex-wrap gap-x-2">
              {grn.linkedPurchaseReturns.map((note) => (
                <a key={note._id} href={`/purchase/returns/${note._id}`} className="text-amber-700 hover:underline">{note.debitNoteNumber}</a>
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
              <th className="px-4 py-2">Qty Ordered</th>
              <th className="px-4 py-2">Qty Received</th>
              <th className="px-4 py-2">Batch</th>
              <th className="px-4 py-2">Expiry</th>
              <th className="px-4 py-2">MRP</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2">GST</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Location</th>
            </tr>
          </thead>
          <tbody>
            {grn.items.map((item, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-2">{item.skuName}</td>
                <td className="px-4 py-2">{item.qtyOrdered}</td>
                <td className="px-4 py-2">{item.qtyReceived}</td>
                <td className="px-4 py-2">{item.batch}</td>
                <td className="px-4 py-2">{new Date(item.expiryDate).toLocaleDateString()}</td>
                <td className="px-4 py-2">₹{Number(item.mrp || 0).toFixed(2)}</td>
                <td className="px-4 py-2">₹{Number(item.rate || 0).toFixed(2)}</td>
                <td className="px-4 py-2">{item.gstRate || 0}%</td>
                <td className="px-4 py-2">₹{Number(item.amount || 0).toFixed(2)}</td>
                <td className="px-4 py-2">{item.skuLocation || "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 font-medium">
              <td className="px-4 py-2">Total</td>
              <td></td>
              <td className="px-4 py-2">{grn.totalQty}</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td className="px-4 py-2 text-right">₹{grn.totalValue.toFixed(2)}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan="8" className="px-4 py-1 text-right">GST</td>
              <td className="px-4 py-1 text-right">₹{Number(grn.gstAmount || 0).toFixed(2)}</td>
              <td></td>
            </tr>
            <tr className="font-semibold">
              <td colSpan="8" className="px-4 py-1 text-right">Grand total</td>
              <td className="px-4 py-1 text-right">₹{Number(grn.grandTotal ?? grn.totalValue).toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
