"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const [po, setPo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getPurchaseOrder(id).then((d) => setPo(d.purchaseOrder)).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!po) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{po.poNumber}</h1>
        <p className="text-sm text-gray-500 capitalize">Status: {po.status.replace("_", " ")}</p>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div><div className="text-gray-500 text-xs">Supplier</div>{po.supplierName}</div>
        <div><div className="text-gray-500 text-xs">Order date</div>{new Date(po.orderDate).toLocaleDateString()}</div>
        <div><div className="text-gray-500 text-xs">Payment term</div>{po.paymentTerm || "-"}</div>
        <div><div className="text-gray-500 text-xs">Expected delivery</div>{po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : "-"}</div>
        <div><div className="text-gray-500 text-xs">Created by</div>{po.createdBy?.name || "-"}</div>
        <div><div className="text-gray-500 text-xs">Created at</div>{new Date(po.createdAt).toLocaleString()}</div>
        <div><div className="text-gray-500 text-xs">Last updated by</div>{po.lastUpdatedBy}</div>
        <div><div className="text-gray-500 text-xs">Last updated at</div>{po.lastUpdatedAt ? new Date(po.lastUpdatedAt).toLocaleString() : "-"}</div>
        <div>
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
              <td className="px-4 py-2">₹{po.totalPrice.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
