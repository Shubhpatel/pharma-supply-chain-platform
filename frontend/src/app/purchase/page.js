"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import BulkPurchaseOrderModal from "@/components/BulkPurchaseOrderModal";

export default function PurchasePage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ search: "", status: "", fromDate: "", toDate: "" });
  const [duplicatingId, setDuplicatingId] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const { token, showToast } = useApp();

  function loadOrders() {
    setLoading(true);
    api.listPurchaseOrders()
      .then((d) => setOrders(d.purchaseOrders))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function handleDuplicate(id) {
    setDuplicatingId(id);
    try {
      const data = await api.duplicatePurchaseOrder(id, token);
      showToast("Purchase order duplicated successfully.");
      window.location.href = `/purchase/${data.purchaseOrder._id}`;
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setDuplicatingId("");
    }
  }

  const filteredOrders = orders.filter((order) => {
    const query = appliedFilters.search.toLowerCase();
    const orderDate = new Date(order.orderDate);
    const matchesSearch = !query || [order.poNumber, order.supplierName].some((value) => value.toLowerCase().includes(query));
    const matchesStatus = !appliedFilters.status || order.status === appliedFilters.status;
    const matchesFrom = !appliedFilters.fromDate || orderDate >= new Date(`${appliedFilters.fromDate}T00:00:00`);
    const matchesTo = !appliedFilters.toDate || orderDate <= new Date(`${appliedFilters.toDate}T23:59:59.999`);
    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchase Orders</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowBulkModal(true)} className="rounded-md border border-teal-700 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50">Add Bulk PO</button>
          <a href="/purchase/new" className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white">+ Add Purchase Order</a>
        </div>
      </div>

      <BulkPurchaseOrderModal isOpen={showBulkModal} onClose={() => setShowBulkModal(false)} onSuccess={loadOrders} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <input placeholder="Search PO or supplier" value={search} onChange={(e) => setSearch(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full sm:w-64" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="placed">Placed</option>
          <option value="partially_received">Partially received</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <fieldset className="flex items-center gap-2 border border-gray-300 rounded-md px-2 py-1">
          <legend className="px-1 text-xs text-gray-500">Order date</legend>
          <input type="date" aria-label="Order date from" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-1 py-1 text-sm" />
          <span className="text-sm text-gray-400">to</span>
          <input type="date" aria-label="Order date to" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-1 py-1 text-sm" />
        </fieldset>
        <button type="button" onClick={() => setAppliedFilters({ search, status, fromDate, toDate })} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white">Filter</button>
        <button type="button" onClick={() => { setSearch(""); setStatus(""); setFromDate(""); setToDate(""); setAppliedFilters({ search: "", status: "", fromDate: "", toDate: "" }); }} className="px-1 py-2 text-sm text-gray-600 hover:text-gray-900 hover:underline">Clear Filters</button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : filteredOrders.length === 0 ? (
        <p className="text-sm text-gray-500">{orders.length === 0 ? "No purchase orders yet." : "No purchase orders match the filters."}</p>
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
                <th className="px-4 py-2">Pending Qty</th>
                <th className="px-4 py-2">Total Price</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o._id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{o.poNumber}</td>
                  <td className="px-4 py-2">{o.supplierName}</td>
                  <td className="px-4 py-2">{new Date(o.orderDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{o.paymentTerm || "-"}</td>
                  <td className="px-4 py-2">{o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : "-"}</td>
                  <td className="px-4 py-2 capitalize">{o.status.replace("_", " ")}</td>
                  <td className="px-4 py-2">{o.totalQty}</td>
                  <td className="px-4 py-2">{o.pendingQty}</td>
                  <td className="px-4 py-2">₹{o.totalPrice.toFixed(2)}</td>
                  <td className="px-4 py-2 space-x-3 whitespace-nowrap">
                    <a href={`/purchase/${o._id}`} title="View purchase order" aria-label="View purchase order" className="text-blue-600 hover:underline"><img src="/icons/view.svg" alt="" className="h-4 w-4" /></a>
                    <button type="button" onClick={() => handleDuplicate(o._id)} disabled={duplicatingId === o._id} className="text-blue-600 hover:underline disabled:opacity-50">
                      {duplicatingId === o._id ? "Duplicating..." : "Duplicate"}
                    </button>
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
