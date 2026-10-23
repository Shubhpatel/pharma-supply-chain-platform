"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import SearchableSelect from "@/components/SearchableSelect";

export default function NewGrnPage() {
  const router = useRouter();
  const [editId, setEditId] = useState(undefined);
  const { token, user, showToast } = useApp();
  const [openPos, setOpenPos] = useState([]);
  const [skuLocations, setSkuLocations] = useState([]);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [grnDate, setGrnDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState("");
  const [purchaseInvoiceDate, setPurchaseInvoiceDate] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const currentEditId = new URLSearchParams(window.location.search).get("edit");
    setEditId(currentEditId);
    Promise.all([
      api.listOpenPurchaseOrders(),
      api.listSkuLocations(true),
      currentEditId ? api.getGrn(currentEditId) : Promise.resolve(null),
    ]).then(([poData, locationData, grnData]) => {
      setOpenPos(poData.purchaseOrders);
      setSkuLocations(locationData.locations || []);
      if (grnData) {
        const grn = grnData.grn;
        setSelectedPoId(grn.purchaseOrder?._id || grn.purchaseOrder || "");
        setGrnDate(new Date(grn.grnDate).toISOString().slice(0, 10));
        setPurchaseInvoiceNumber(grn.purchaseInvoiceNumber || "");
        setPurchaseInvoiceDate(new Date(grn.purchaseInvoiceDate).toISOString().slice(0, 10));
        setItems(grn.items.map((item) => ({ ...item, qtyOrdered: item.qtyOrdered, qtyReceived: String(item.qtyReceived), mrp: String(item.mrp), rate: String(item.rate), gstRate: String(item.gstRate || 0) })));
      }
    }).catch((e) => setError(e.message));
  }, []);

  function handleSelectPo(poId) {
    setSelectedPoId(poId);
    const po = openPos.find((p) => p._id === poId);
    if (!po) return setItems([]);
    setItems(
      po.items.filter((i) => i.pendingQty > 0).map((i) => ({
        sku: i.sku,
        skuName: i.skuName,
        skuLocation: skuLocations.find((entry) => String(entry.sku?._id || entry.sku) === String(i.sku?._id || i.sku))?.location || "",
        qtyOrdered: i.pendingQty,
        qtyReceived: i.pendingQty,
        batch: "",
        expiryDate: "",
        mrp: "",
        rate: i.rate,
        gstRate: i.gstRate ?? "0",
      }))
    );
  }

  const selectedPo = openPos.find((po) => po._id === selectedPoId);

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
    if (!purchaseInvoiceNumber.trim()) return setError("Enter the purchase invoice number.");
    if (!purchaseInvoiceDate) return setError("Select the purchase invoice date.");

    setLoading(true);
    try {
      const payload = {
        purchaseOrderId: selectedPoId,
        grnDate,
        purchaseInvoiceNumber: purchaseInvoiceNumber.trim(),
        purchaseInvoiceDate,
        items: items.map((i) => ({ ...i, qtyReceived: Number(i.qtyReceived) })),
      };
      const data = editId ? await api.updateGrn(editId, payload, token) : await api.createGrn(payload, token);
      showToast(editId ? "GRN updated successfully." : "GRN created successfully.");
      router.push(`/grn/${data.grn._id}`);
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <h1 className="text-xl font-semibold">{editId ? "Edit GRN" : "Add a GRN"}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Purchase order</label>
            <SearchableSelect
              value={selectedPoId}
              onChange={handleSelectPo}
              options={openPos.map((po) => ({ value: po._id, label: `${po.poNumber} - ${po.supplierName}` }))}
              placeholder="Select a PO awaiting receipt"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">GRN date</label>
            <input required type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Supplier</label>
            <div className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50">
              {selectedPo?.supplier?.name || selectedPo?.supplierName || "Select a purchase order"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Purchase invoice number</label>
            <input required type="text" value={purchaseInvoiceNumber} onChange={(e) => setPurchaseInvoiceNumber(e.target.value)}
              placeholder="Enter invoice number"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Purchase invoice date</label>
            <input required type="date" value={purchaseInvoiceDate} onChange={(e) => setPurchaseInvoiceDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        {items.length > 0 && (
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold">Items to receive</h2>
            </div>
            <div className="overflow-x-auto p-4">
              <div className="min-w-[980px] space-y-2">
                <div className="grid grid-cols-12 items-center gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <div className="col-span-3">SKU / Location</div>
                  <div className="col-span-2">Batch</div>
                  <div className="col-span-2">Expiry</div>
                  <div className="col-span-1">MRP</div>
                  <div className="col-span-1">GST</div>
                  <div className="col-span-1">Rate</div>
                  <div className="col-span-1">Pending</div>
                  <div className="col-span-1">Received</div>
                </div>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-3 border-t border-gray-100 py-2">
                    <div className="col-span-3 min-w-0 text-sm">
                      <div className="truncate font-medium text-gray-900">{item.skuName}</div>
                      <div className="truncate text-xs text-gray-500">{item.skuLocation || "No location assigned"}</div>
                    </div>
                    <input required placeholder="Batch" value={item.batch}
                      onChange={(e) => setItems((prev) => prev.map((current, index) => index === i ? { ...current, batch: e.target.value } : current))}
                      className="col-span-2 w-full border border-gray-300 rounded-md px-2 py-2 text-sm" />
                    <input required type="date" value={item.expiryDate}
                      onChange={(e) => setItems((prev) => prev.map((current, index) => index === i ? { ...current, expiryDate: e.target.value } : current))}
                      className="col-span-2 w-full border border-gray-300 rounded-md px-2 py-2 text-sm" />
                    <input required type="number" min="0" step="0.01" placeholder="MRP" value={item.mrp}
                      onChange={(e) => setItems((prev) => prev.map((current, index) => index === i ? { ...current, mrp: e.target.value } : current))}
                      className="col-span-1 w-full border border-gray-300 rounded-md px-2 py-2 text-sm" />
                    <div className="col-span-1 w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-2 text-sm">
                      {item.gstRate ?? 0}%
                    </div>
                    <input required type="number" min="0" step="0.01" placeholder="Rate" value={item.rate}
                      onChange={(e) => setItems((prev) => prev.map((current, index) => index === i ? { ...current, rate: e.target.value } : current))}
                      className="col-span-1 w-full border border-gray-300 rounded-md px-2 py-2 text-sm" />
                    <div className="col-span-1 text-sm text-gray-700">{item.qtyOrdered}</div>
                    <input required type="number" min="0" max={item.qtyOrdered} value={item.qtyReceived}
                      onChange={(e) => updateReceived(i, e.target.value)}
                      className="col-span-1 w-full border border-gray-300 rounded-md px-2 py-2 text-sm" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading || items.length === 0}
            className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium disabled:opacity-50">
            {loading ? "Saving..." : editId ? "Update GRN" : "Save GRN"}
          </button>
          <a href="/grn" className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium">Cancel</a>
        </div>
      </form>
    </div>
  );
}
