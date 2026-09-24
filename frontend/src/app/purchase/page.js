"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function PurchasePage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listPurchaseOrders()
      .then((d) => setOrders(d.purchaseOrders))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchase Orders</h1>
        <a href="/purchase/new" className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium">
          + Add Purchase Order
        </a>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-500">No purchase orders yet.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">PO Number</th>
                <th className="px-4 py-2">Supplier</th>
                <th className="px-4 py-2">Order Date</th>
                <th className="px-4 py-2">Payment Term</th>
                <th className="px-4 py-2">Delivery Date</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Total Qty</th>
                <th className="px-4 py-2">Total Price</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{o.poNumber}</td>
                  <td className="px-4 py-2">{o.supplierName}</td>
                  <td className="px-4 py-2">{new Date(o.orderDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{o.paymentTerm || "-"}</td>
                  <td className="px-4 py-2">{o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : "-"}</td>
                  <td className="px-4 py-2 capitalize">{o.status.replace("_", " ")}</td>
                  <td className="px-4 py-2">{o.totalQty}</td>
                  <td className="px-4 py-2">₹{o.totalPrice.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <a href={`/purchase/${o._id}`} className="text-blue-600 hover:underline">View</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
