"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function GrnDetailPage() {
  const { id } = useParams();
  const [grn, setGrn] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getGrn(id).then((d) => setGrn(d.grn)).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!grn) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{grn.grnNumber}</h1>
        <p className="text-sm text-gray-500">Against PO {grn.poNumber}</p>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div><div className="text-gray-500 text-xs">Supplier</div>{grn.supplierName}</div>
        <div><div className="text-gray-500 text-xs">GRN date</div>{new Date(grn.grnDate).toLocaleDateString()}</div>
        <div><div className="text-gray-500 text-xs">Created by</div>{grn.createdBy?.name || "-"}</div>
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
              <th className="px-4 py-2">Amount</th>
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
                <td className="px-4 py-2">₹{Number(item.amount || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 font-medium">
              <td className="px-4 py-2">Total</td>
              <td></td>
              <td className="px-4 py-2">{grn.totalQty}</td>
              <td></td>
              <td className="px-4 py-2">₹{grn.totalValue.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
