"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import LineItemsEditor from "@/components/LineItemsEditor";

export default function NewInvoicePage() {
  const router = useRouter();
  const { token, user, showToast } = useApp();
  const [skus, setSkus] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [form, setForm] = useState({ customerName: "", saleDate: new Date().toISOString().slice(0, 10) });
  const [items, setItems] = useState([{ sku: "", skuName: "", batch: "", expiryDate: "", mrp: "", qty: "", rate: "" }]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listSkus(true).then((d) => setSkus(d.skus)).catch((e) => setError(e.message));
    api.listStock().then((d) => setInventory(d.stock || [])).catch((e) => setError(e.message));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!user) return setError("Log in to create an invoice.");

    setLoading(true);
    try {
      const payload = {
        ...form,
        items: items.map((i) => ({
          sku: i.sku,
          skuName: i.skuName,
          batch: i.batch,
          expiryDate: i.expiryDate,
          mrp: Number(i.mrp),
          qty: Number(i.qty),
          rate: Number(i.rate),
        })),
      };
      const data = await api.createInvoice(payload, token);
      showToast("Invoice created successfully.");
      router.push(`/sales/${data.invoice._id}`);
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Add Invoice</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Customer</label>
            <input required value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
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
            {loading ? "Saving..." : "Save Invoice"}
          </button>
          <a href="/sales" className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium">Cancel</a>
        </div>
      </form>
    </div>
  );
}
