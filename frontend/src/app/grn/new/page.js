"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

export default function NewGrnPage() {
  const router = useRouter();
  const { token, user } = useApp();
  const [openPos, setOpenPos] = useState([]);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [grnDate, setGrnDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listOpenPurchaseOrders().then((d) => setOpenPos(d.purchaseOrders)).catch((e) => setError(e.message));
  }, []);

  function handleSelectPo(poId) {
    setSelectedPoId(poId);
    const po = openPos.find((p) => p._id === poId);
    if (!po) return setItems([]);
    setItems(
      po.items.map((i) => ({
        sku: i.sku,
        skuName: i.skuName,
        qtyOrdered: i.qty,
        qtyReceived: i.qty, // default to fully received; user can edit down for partial
        rate: i.rate,
      }))
    );
  }

  function updateReceived(index, value) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], qtyReceived: value };
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!user) return setError("Log in to create a GRN.");
    if (!selectedPoId) return setError("Select a purchase order.");

    setLoading(true);
    try {
      const payload = {
        purchaseOrderId: selectedPoId,
        grnDate,
        items: items.map((i) => ({ ...i, qtyReceived: Number(i.qtyReceived) })),
      };
      const data = await api.createGrn(payload, token);
      router.push(`/grn/${data.grn._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Add a GRN</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Purchase order</label>
            <select required value={selectedPoId} onChange={(e) => handleSelectPo(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="" disabled>Select a PO awaiting receipt</option>
              {openPos.map((po) => (
                <option key={po._id} value={po._id}>{po.poNumber} - {po.supplierName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">GRN date</label>
            <input required type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        {items.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-2">
            <h2 className="text-sm font-semibold mb-2">Items to receive</h2>
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-5">SKU</div>
              <div className="col-span-3">Qty Ordered</div>
              <div className="col-span-4">Qty Received</div>
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5 text-sm">{item.skuName}</div>
                <div className="col-span-3 text-sm text-gray-600">{item.qtyOrdered}</div>
                <input type="number" min="0" max={item.qtyOrdered} value={item.qtyReceived}
                  onChange={(e) => updateReceived(i, e.target.value)}
                  className="col-span-4 border border-gray-300 rounded-md px-2 py-2 text-sm" />
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading || items.length === 0}
            className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium disabled:opacity-50">
            {loading ? "Saving..." : "Confirm GRN"}
          </button>
          <a href="/grn" className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium">Cancel</a>
        </div>
      </form>
    </div>
  );
}
