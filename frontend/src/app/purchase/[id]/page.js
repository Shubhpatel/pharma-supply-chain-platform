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

  async function handleDownloadPdf() {
    try {
      await api.downloadPdf(`/purchase-orders/${id}/pdf`, `${po.poNumber || "PO"}.pdf`, token);
      showToast("PDF downloaded successfully.");
    } catch (err) {
      showToast(err.message || "Failed to download PDF", "error");
    }
  }

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
          <p className="text-sm text-gray-500 mt-0.5">
            Status: <span className={`status-badge status-${po.status} ml-1`}>{po.status.replace("_", " ")}</span>
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <button type="button" onClick={handleDuplicate} disabled={duplicating} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">{duplicating ? "Duplicating..." : "Duplicate"}</button>
          {(["draft", "placed"].includes(po.status) || user?.role === "ADMIN") && <a href={`/purchase/new?edit=${po._id}`} className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">Edit</a>}
          {(["draft", "placed"].includes(po.status) || user?.role === "ADMIN") && <button type="button" onClick={handleDelete} className="rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Delete</button>}
          {po.status === "draft" && <button type="button" onClick={handleConfirm} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">Confirm PO</button>}
          <button onClick={handleDownloadPdf} type="button" className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF
          </button>
          <button onClick={handlePrint} type="button" className="inline-flex items-center gap-2 rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print
          </button>
        </div>
      </div>

      {lastPrinted && (
        <div className="text-xs text-gray-500 border-b border-gray-100 pb-2">
          Last printed by: <span className="font-medium text-gray-700">{lastPrinted.printedBy}</span> at{" "}
          <span className="font-medium text-gray-700">{new Date(lastPrinted.printedAt).toLocaleString()}</span>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-5 bg-white grid grid-cols-2 sm:grid-cols-3 gap-5 text-sm">
        <div><div className="info-label">Supplier</div><div className="info-value">{po.supplierName}</div></div>
        <div><div className="info-label">Order date</div><div className="info-value">{new Date(po.orderDate).toLocaleDateString()}</div></div>
        <div><div className="info-label">Payment term</div><div className="info-value">{po.paymentTerm || "-"}</div></div>
        <div><div className="info-label">Expected delivery</div><div className="info-value">{po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : "-"}</div></div>
        <div><div className="info-label">Created by</div><div className="info-value">{po.createdBy?.name || "-"}</div></div>
        <div><div className="info-label">Created at</div><div className="info-value">{new Date(po.createdAt).toLocaleString()}</div></div>
        <div><div className="info-label">Last updated by</div><div className="info-value">{po.lastUpdatedBy || "-"}</div></div>
        <div><div className="info-label">Last updated at</div><div className="info-value">{po.lastUpdatedAt ? new Date(po.lastUpdatedAt).toLocaleString() : "-"}</div></div>
        {po.supplier && (
          <div className="sm:col-span-3 border-t border-gray-100 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><div className="info-label">Vendor GST</div><div className="info-value">{po.supplier.gstNumber || "-"}</div></div>
            <div><div className="info-label">Contact person</div><div className="info-value">{po.supplier.contactPerson || "-"}</div></div>
            <div><div className="info-label">Phone / email</div><div className="info-value">{[po.supplier.phone, po.supplier.email].filter(Boolean).join(" / ") || "-"}</div></div>
            <div><div className="info-label">Address</div><div className="info-value">{[po.supplier.addressLine1, po.supplier.addressLine2, po.supplier.city, po.supplier.state, po.supplier.postalCode].filter(Boolean).join(", ") || "-"}</div></div>
          </div>
        )}
        <div className="sm:col-span-3 border-t border-gray-100 pt-4">
          <div className="info-label">Linked GRN</div>
          {po.linkedGrns?.length ? (
            <div className="flex flex-wrap gap-x-2 mt-0.5">
              {po.linkedGrns.map((grn) => (
                <a key={grn._id} href={`/grn/${grn._id}`} className="text-teal-700 hover:underline font-medium">{grn.grnNumber}</a>
              ))}
            </div>
          ) : <div className="info-value">-</div>}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Pending</th>
              <th className="px-4 py-2 text-right">Rate</th>
              <th className="px-4 py-2 text-right">GST</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((item, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-2">{item.skuName}</td>
                <td className="px-4 py-2 text-right tabular-nums">{item.qty}</td>
                <td className="px-4 py-2 text-right tabular-nums">{item.pendingQty}</td>
                <td className="px-4 py-2 text-right tabular-nums">₹{item.rate.toFixed(2)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{item.gstRate || 0}%</td>
                <td className="px-4 py-2 text-right tabular-nums">₹{item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 font-semibold bg-gray-50">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{po.totalQty}</td>
              <td className="px-4 py-2 text-right tabular-nums">{po.pendingQty}</td>
              <td></td>
              <td></td>
              <td className="px-4 py-2 text-right tabular-nums">₹{po.totalPrice.toFixed(2)}</td>
            </tr>
            <tr className="border-t border-gray-100 text-gray-600">
              <td colSpan="5" className="px-4 py-1 text-right text-xs font-medium uppercase tracking-wide text-gray-400">GST</td>
              <td className="px-4 py-1 text-right tabular-nums">₹{Number(po.gstAmount || 0).toFixed(2)}</td>
            </tr>
            <tr className="font-bold text-gray-900 bg-teal-50">
              <td colSpan="5" className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-teal-700">Grand Total</td>
              <td className="px-4 py-2 text-right tabular-nums text-teal-800">₹{Number(po.grandTotal ?? po.totalPrice).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
