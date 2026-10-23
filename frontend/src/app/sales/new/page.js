"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import LineItemsEditor from "@/components/LineItemsEditor";
import SearchableSelect from "@/components/SearchableSelect";

export default function NewInvoicePage() {
  const router = useRouter();
  const [duplicateId, setDuplicateId] = useState(undefined);
  const [editId, setEditId] = useState(undefined);
  const { token, user, showToast } = useApp();
  const [skus, setSkus] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [form, setForm] = useState({ customerId: "", customerName: "", saleDate: new Date().toISOString().slice(0, 10) });
  const [items, setItems] = useState([{ sku: "", skuName: "", batch: "", expiryDate: "", mrp: "", qty: "", rate: "", gstRate: "0" }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDuplicateId(new URLSearchParams(window.location.search).get("duplicate"));
    setEditId(new URLSearchParams(window.location.search).get("edit"));
  }, []);

  useEffect(() => {
    if (!token || duplicateId === undefined || editId === undefined) return;
    const sourceId = editId || duplicateId;
    const sourceRequest = sourceId ? api.getInvoice(sourceId) : Promise.resolve(null);
    Promise.all([api.listSkus(true), api.listStock(token), api.listParties("customer"), sourceRequest])
      .then(([skuData, stockData, customerData, sourceData]) => {
        setSkus(skuData.skus);
        setInventory(stockData.stock || []);
        setCustomers(customerData.parties);
        if (sourceData) {
          const source = sourceData.invoice;
          setForm({
            customerId: source.customer?._id || source.customer || "",
            customerName: source.customerName || "",
            saleDate: editId ? new Date(source.saleDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          });
          setItems(source.items.map((item) => ({
            sku: item.sku,
            skuName: item.skuName,
            batch: item.batch || "",
            expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : "",
            mrp: String(item.mrp),
            qty: String(item.qty),
            rate: String(item.rate),
            gstRate: String(item.gstRate || 0),
          })));
        }
      })
      .catch((e) => setError(e.message));
  }, [duplicateId, editId, token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!user) return setError("Log in to create an invoice.");

    setLoading(true);
    try {
      const payload = {
        ...form,
        customerId: form.customerId,
        customerName: customers.find((customer) => customer._id === form.customerId)?.name || "",
        items: items.map((i) => ({
          sku: i.sku,
          skuName: i.skuName,
          batch: i.batch,
          expiryDate: i.expiryDate,
          mrp: Number(i.mrp),
          qty: Number(i.qty),
          rate: Number(i.rate),
          gstRate: Number(i.gstRate),
        })),
      };
      const data = editId ? await api.updateInvoice(editId, payload, token) : await api.createInvoice(payload, token);
      showToast(editId ? "Invoice updated successfully." : "Invoice created successfully.");
      router.push(`/sales/${data.invoice._id}`);
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <h1 className="text-xl font-semibold">{editId ? "Edit Invoice" : duplicateId ? "Duplicate Invoice" : "Add Invoice"}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Customer</label>
            <SearchableSelect required value={form.customerId}
              onChange={(value) => setForm((f) => ({ ...f, customerId: value }))}
              options={customers.map((customer) => ({ value: customer._id, label: `${customer.name}${customer.gstNumber ? ` - ${customer.gstNumber}` : ""}` }))}
              placeholder="Select customer" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sale date</label>
            <input required type="date" value={form.saleDate} onChange={(e) => setForm((f) => ({ ...f, saleDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <h2 className="text-sm font-semibold mb-3">Line items</h2>
          <LineItemsEditor items={items} setItems={setItems} skus={skus} inventory={inventory} includeBatch />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium disabled:opacity-50">
            {loading ? "Saving..." : editId ? "Update Invoice" : "Save Invoice"}
          </button>
          <a href="/sales" className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium">Cancel</a>
        </div>
      </form>
    </div>
  );
}
