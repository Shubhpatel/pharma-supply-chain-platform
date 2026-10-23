"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import LineItemsEditor from "@/components/LineItemsEditor";
import SearchableSelect from "@/components/SearchableSelect";

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [duplicateId, setDuplicateId] = useState(undefined);
  const [editId, setEditId] = useState(undefined);
  const isEditMode = Boolean(editId);
  const { token, user, showToast } = useApp();
  const [skus, setSkus] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [form, setForm] = useState({
    supplierId: "",
    supplierName: "",
    orderDate: new Date().toISOString().slice(0, 10),
    paymentTerm: "",
    expectedDeliveryDate: "",
    gstRate: "0",
  });
  const [items, setItems] = useState([{ sku: "", skuName: "", qty: "", rate: "", gstRate: "0" }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDuplicateId(new URLSearchParams(window.location.search).get("duplicate"));
    setEditId(new URLSearchParams(window.location.search).get("edit"));
    const assistantDraft = sessionStorage.getItem("assistantPurchaseDraft");
    const assistantForm = sessionStorage.getItem("assistantPurchaseForm");
    if (assistantDraft) {
      try {
        const draftItems = JSON.parse(assistantDraft);
        if (Array.isArray(draftItems) && draftItems.length > 0) setItems(draftItems);
        sessionStorage.removeItem("assistantPurchaseDraft");
      } catch {
        sessionStorage.removeItem("assistantPurchaseDraft");
      }
    }
    if (assistantForm) {
      try {
        const draftForm = JSON.parse(assistantForm);
        if (draftForm && typeof draftForm === "object") {
          setForm((current) => ({ ...current, ...draftForm }));
        }
        sessionStorage.removeItem("assistantPurchaseForm");
      } catch {
        sessionStorage.removeItem("assistantPurchaseForm");
      }
    }
  }, []);

  useEffect(() => {
    if (duplicateId === undefined || editId === undefined) return;
    const sourceId = editId || duplicateId;
    const sourceRequest = sourceId ? api.getPurchaseOrder(sourceId) : Promise.resolve(null);
    Promise.all([api.listSkus(true), api.listParties("vendor"), sourceRequest])
      .then(([skuData, vendorData, sourceData]) => {
        setSkus(skuData.skus);
        setVendors(vendorData.parties);
        if (sourceData) {
          const source = sourceData.purchaseOrder;
          setForm({
            supplierId: source.supplier?._id || source.supplier || "",
            supplierName: source.supplierName || "",
            orderDate: editId ? new Date(source.orderDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            paymentTerm: source.paymentTerm || "",
            expectedDeliveryDate: source.expectedDeliveryDate ? new Date(source.expectedDeliveryDate).toISOString().slice(0, 10) : "",
            gstRate: "0",
          });
          setItems(source.items.map((item) => ({
            sku: item.sku,
            skuName: item.skuName,
            qty: String(item.qty),
            rate: String(item.rate),
            gstRate: String(item.gstRate || 0),
          })));
        }
      })
      .catch((e) => setError(e.message));
  }, [duplicateId, editId]);

  const searchSkus = useCallback(async (search) => {
    try {
      const data = await api.searchSkus(search, true, token);
      setSkus((current) => {
        const results = data.skus || [];
        const selectedIds = new Set(items.map((item) => item.sku).filter(Boolean));
        return [...results, ...current.filter((sku) => selectedIds.has(sku._id) && !results.some((result) => result._id === sku._id))];
      });
    } catch (err) {
      setError(err.message);
    }
  }, [token, items]);

  const searchVendors = useCallback(async (search) => {
    try {
      const data = await api.searchParties("vendor", search, token);
      setVendors((current) => {
        const selected = current.find((vendor) => vendor._id === form.supplierId);
        return selected && !(data.parties || []).some((vendor) => vendor._id === selected._id)
          ? [selected, ...(data.parties || [])]
          : data.parties || [];
      });
    } catch (err) {
      setError(err.message);
    }
  }, [token, form.supplierId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!user) return setError("Log in to create a purchase order.");

    setLoading(true);
    try {
      const payload = {
        ...form,
        supplierId: form.supplierId,
        supplierName: vendors.find((vendor) => vendor._id === form.supplierId)?.name || "",
        items: items.map((i) => ({ sku: i.sku, skuName: i.skuName, qty: Number(i.qty), rate: Number(i.rate), gstRate: Number(i.gstRate) })),
      };
      const data = editId ? await api.updatePurchaseOrder(editId, payload, token) : await api.createPurchaseOrder(payload, token);
      showToast(editId ? "Purchase order updated successfully." : "Purchase order created successfully.");
      router.push(`/purchase/${data.purchaseOrder._id}`);
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }

  }

  return (
    <div className="w-full space-y-6">
      <h1 className="text-xl font-semibold">{editId ? "Edit Purchase Order" : duplicateId ? "Duplicate Purchase Order" : "Add a Purchase Order"}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Supplier</label>
            <SearchableSelect
              required
              disabled={isEditMode}
              value={form.supplierId}
              onChange={(value) => setForm((f) => ({ ...f, supplierId: value }))}
              options={vendors.map((vendor) => ({ value: vendor._id, label: `${vendor.name}${vendor.gstNumber ? ` - ${vendor.gstNumber}` : ""}` }))}
              onSearch={searchVendors}
              placeholder="Select vendor" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Order date</label>
            <input
              required
              type="date"
              value={form.orderDate}
              disabled={isEditMode}
              onChange={(e) => setForm((f) => ({ ...f, orderDate: e.target.value }))}
              className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm ${isEditMode ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Payment term</label>
            <select value={form.paymentTerm}
              disabled={isEditMode}
              onChange={(e) => setForm((f) => ({ ...f, paymentTerm: e.target.value }))}
              className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm ${isEditMode ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}>
              <option value="">Select payment term</option>
              <option value="Advanced">Advanced</option>
              <option value="30 day">30 day</option>
              <option value="60 days">60 days</option>
              <option value="90 days">90 days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Expected delivery date</label>
            <input type="date" value={form.expectedDeliveryDate}
              disabled={isEditMode}
              onChange={(e) => setForm((f) => ({ ...f, expectedDeliveryDate: e.target.value }))}
              className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm ${isEditMode ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`} />
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <h2 className="text-sm font-semibold mb-3">Line items</h2>
          <LineItemsEditor items={items} setItems={setItems} skus={skus} onSearchSkus={searchSkus} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading}
            className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium disabled:opacity-50">
            {loading ? "Saving…" : editId ? "Update Purchase Order" : "Save Purchase Order"}
          </button>
          <a href="/purchase" className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</a>
        </div>
      </form>
    </div>
  );
}
