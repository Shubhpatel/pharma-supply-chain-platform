"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const { user, token, showToast } = useApp();
  const [po, setPo] = useState(null);
  const [error, setError] = useState("");
  const [lastPrinted, setLastPrinted] = useState(null);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    api.getPurchaseOrder(id).then((d) => setPo(d.purchaseOrder)).catch((e) => setError(e.message));
    const printedInfo = localStorage.getItem(`printed_po_${id}`);
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
    localStorage.setItem(`printed_po_${id}`, JSON.stringify(printData));
    setTimeout(() => {
      window.print();
    }, 100);
  }

  async function handleConfirm() {
    try {
      const data = await api.confirmPurchaseOrder(id, token);
      setPo(data.purchaseOrder);
      showToast("Purchase order confirmed.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const data = await api.duplicatePurchaseOrder(id, token);
      showToast("Purchase order duplicated successfully.");
      window.location.href = `/purchase/${data.purchaseOrder._id}`;
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setDuplicating(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this purchase order?")) return;
    try {
      await api.deletePurchaseOrder(id, token);
      showToast("Purchase order deleted.");
      window.location.href = "/purchase";
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!po) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="w-full space-y-6 print:p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{po.poNumber}</h1>
          <p className="text-sm text-gray-500 capitalize">Status: {po.status.replace("_", " ")}</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <button type="button" onClick={handleDuplicate} disabled={duplicating} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">{duplicating ? "Duplicating..." : "Duplicate"}</button>
          {["draft", "placed"].includes(po.status) && <a href={`/purchase/new?edit=${po._id}`} className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">Edit</a>}
          {["draft", "placed"].includes(po.status) && <button type="button" onClick={handleDelete} className="rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Delete</button>}
          {po.status === "draft" && <button type="button" onClick={handleConfirm} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">Confirm PO</button>}
          <button onClick={handlePrint} type="button" className="inline-flex items-center gap-2 rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / PDF
          </button>
        </div>
      </div>

      {lastPrinted && (
        <div className="text-xs text-gray-500 border-b border-gray-100 pb-2">
          Last printed by: <span className="font-medium text-gray-700">{lastPrinted.printedBy}</span> at{" "}
          <span className="font-medium text-gray-700">{new Date(lastPrinted.printedAt).toLocaleString()}</span>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-4 bg-white grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div><div className="text-gray-500 text-xs">Supplier</div>{po.supplierName}</div>
        <div><div className="text-gray-500 text-xs">Order date</div>{new Date(po.orderDate).toLocaleDateString()}</div>
        <div><div className="text-gray-500 text-xs">Payment term</div>{po.paymentTerm || "-"}</div>
        <div><div className="text-gray-500 text-xs">Expected delivery</div>{po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : "-"}</div>
        <div><div className="text-gray-500 text-xs">Created by</div>{po.createdBy?.name || "-"}</div>
        <div><div className="text-gray-500 text-xs">Created at</div>{new Date(po.createdAt).toLocaleString()}</div>
        <div><div className="text-gray-500 text-xs">Last updated by</div>{po.lastUpdatedBy}</div>
        <div><div className="text-gray-500 text-xs">Last updated at</div>{po.lastUpdatedAt ? new Date(po.lastUpdatedAt).toLocaleString() : "-"}</div>
        {po.supplier && (
          <div className="sm:col-span-3 border-t border-gray-100 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><div className="text-gray-500 text-xs">Vendor GST</div>{po.supplier.gstNumber || "-"}</div>
            <div><div className="text-gray-500 text-xs">Contact person</div>{po.supplier.contactPerson || "-"}</div>
            <div><div className="text-gray-500 text-xs">Phone / email</div>{[po.supplier.phone, po.supplier.email].filter(Boolean).join(" / ") || "-"}</div>
            <div><div className="text-gray-500 text-xs">Address</div>{[po.supplier.addressLine1, po.supplier.addressLine2, po.supplier.city, po.supplier.state, po.supplier.postalCode].filter(Boolean).join(", ") || "-"}</div>
          </div>
        )}
        <div className="sm:col-span-3 border-t border-gray-100 pt-3">
          <div className="text-gray-500 text-xs">Linked GRN</div>
          {po.linkedGrns?.length ? (
            <div className="flex flex-wrap gap-x-2">
              {po.linkedGrns.map((grn) => (
                <a key={grn._id} href={`/grn/${grn._id}`} className="text-blue-600 hover:underline">{grn.grnNumber}</a>
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
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Pending</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2">GST</th>
              <th className="px-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((item, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-2">{item.skuName}</td>
                <td className="px-4 py-2">{item.qty}</td>
                <td className="px-4 py-2">{item.pendingQty}</td>
                <td className="px-4 py-2">₹{item.rate.toFixed(2)}</td>
                <td className="px-4 py-2">{item.gstRate || 0}%</td>
                <td className="px-4 py-2">₹{item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 font-medium">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2">{po.totalQty}</td>
              <td className="px-4 py-2">{po.pendingQty}</td>
              <td></td>
              <td></td>
              <td className="px-4 py-2 text-right">₹{po.totalPrice.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan="5" className="px-4 py-1 text-right">GST</td>
              <td className="px-4 py-1 text-right">₹{Number(po.gstAmount || 0).toFixed(2)}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan="5" className="px-4 py-1 text-right">Grand total</td>
              <td className="px-4 py-1 text-right">₹{Number(po.grandTotal ?? po.totalPrice).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
