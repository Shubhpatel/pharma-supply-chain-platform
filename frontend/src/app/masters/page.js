"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import PartyManager from "@/components/PartyManager";
import SkuLocationManager from "@/components/SkuLocationManager";
import BulkUploadModal from "@/components/BulkUploadModal";
import BulkUploadHistory from "@/components/BulkUploadHistory";

const BLANK_FORM = { name: "", hsnCode: "", category: "", subCategory: "", manufacturer: "", uom: "UNIT", mrp: "" };

export default function MastersPage() {
  const { user, token, showToast } = useApp();
  const [skus, setSkus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(BLANK_FORM);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeView, setActiveView] = useState("sku");
  const [showBulkModal, setShowBulkModal] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await api.listSkus();
      setSkus(d.skus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get("tab");
    if (requestedView === "vendor" || requestedView === "customer" || requestedView === "location" || requestedView === "bulk") {
      setActiveView(requestedView);
    }
  }, []);

  function startEdit(sku) {
    setEditingId(sku._id);
    setShowForm(true);
    setForm({
      name: sku.name, hsnCode: sku.hsnCode, category: sku.category, subCategory: sku.subCategory,
      manufacturer: sku.manufacturer, uom: sku.uom, mrp: sku.mrp,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!user) return setError("Log in to manage SKUs.");

    const payload = { ...form, mrp: Number(form.mrp) || 0 };
    setBusy(true);
    try {
      if (editingId) {
        await api.updateSku(editingId, payload, token);
        showToast("SKU updated successfully.");
      } else {
        await api.createSku(payload, token);
        showToast("SKU created successfully.");
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(id) {
    setBusy(true);
    try {
      await api.toggleSku(id, token);
      showToast("SKU status updated.");
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this SKU permanently?")) return;
    setBusy(true);
    try {
      await api.deleteSku(id, token);
      showToast("SKU deleted successfully.");
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(format) {
    try {
      await api.downloadSkus(format, token);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <h1 className="text-xl font-semibold text-gray-900">
          {activeView === "vendor"
            ? "Master Vendors"
            : activeView === "customer"
            ? "Master Customers"
            : activeView === "location"
            ? "Master SKU Locations"
            : activeView === "bulk"
            ? "Bulk Generic Upload"
            : "Master SKUs"}
        </h1>
        <div className="flex items-center gap-2">
          <a
            href="/masters?tab=bulk"
            className={`px-3 py-1.5 rounded-md text-xs font-medium ${
              activeView === "bulk" ? "bg-teal-800 text-white" : "text-teal-700 bg-teal-50 hover:bg-teal-100"
            }`}
          >
            Bulk Generic Upload
          </a>
        </div>
      </div>

      <BulkUploadModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        initialMasterType={activeView === "vendor" ? "vendor" : activeView === "customer" ? "customer" : "sku"}
        onSuccess={load}
      />

      {activeView === "vendor" ? (
        <PartyManager type="vendor" title="Vendor" />
      ) : activeView === "customer" ? (
        <PartyManager type="customer" title="Customer" />
      ) : activeView === "location" ? (
        <SkuLocationManager />
      ) : activeView === "bulk" ? (
        <BulkUploadHistory onOpenModal={() => setShowBulkModal(true)} />
      ) : (
        <>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!editingId && (
          <>
            <button type="button" onClick={() => handleExport("csv")} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Export CSV</button>
            <button type="button" onClick={() => handleExport("xlsx")} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Export Excel</button>
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 rounded-md border border-teal-700 text-teal-800 text-sm font-medium hover:bg-teal-50"
            >
              Add Bulk
            </button>
            <button type="button" onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium">
              Add New SKU
            </button>
          </>
        )}
      </div>

      {(editingId || showForm) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">{editingId ? "Edit SKU" : "Add a new SKU"}</h2>
              <button type="button" onClick={cancelEdit} aria-label="Close" className="text-xl font-bold leading-none text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input required placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
                <input placeholder="HSN code" value={form.hsnCode} onChange={(e) => setForm((f) => ({ ...f, hsnCode: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
                <input placeholder="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
                <input placeholder="Sub category" value={form.subCategory} onChange={(e) => setForm((f) => ({ ...f, subCategory: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
                <input placeholder="Manufacturer" value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
                <input placeholder="UOM (e.g. UNIT, STRIP)" value={form.uom} onChange={(e) => setForm((f) => ({ ...f, uom: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
                <input type="number" placeholder="MRP" value={form.mrp} onChange={(e) => setForm((f) => ({ ...f, mrp: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={busy}
                  className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium disabled:opacity-50">
                  {editingId ? "Save changes" : "Add SKU"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Master UID</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Manufacturer</th>
                <th className="px-4 py-2">UOM</th>
                <th className="px-4 py-2">MRP</th>
                <th className="px-4 py-2">Enabled</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {skus.map((s) => (
                <tr key={s._id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{s.uid || "-"}</td>
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2">{s.category || "-"}</td>
                  <td className="px-4 py-2">{s.manufacturer || "-"}</td>
                  <td className="px-4 py-2">{s.uom}</td>
                  <td className="px-4 py-2">₹{s.mrp}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => handleToggle(s._id)} disabled={busy}
                      className={`px-2 py-1 rounded text-xs font-medium ${s.enabled ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                      {s.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-2 space-x-2">
                    <button onClick={() => startEdit(s)} title="Edit SKU" aria-label="Edit SKU" className="text-blue-600 hover:underline"><img src="/icons/edit.svg" alt="" className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(s._id)} title="Delete SKU" aria-label="Delete SKU" className="text-red-500 hover:underline"><img src="/icons/delete.svg" alt="" className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  );
}
