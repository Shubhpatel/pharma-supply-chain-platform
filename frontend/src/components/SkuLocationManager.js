"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import SearchableSelect from "@/components/SearchableSelect";
import BulkUploadModal from "@/components/BulkUploadModal";

const BLANK_FORM = { sku: "", location: "" };

export default function SkuLocationManager() {
  const { user, token, showToast } = useApp();
  const [locations, setLocations] = useState([]);
  const [skus, setSkus] = useState([]);
  const [form, setForm] = useState(BLANK_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [data, skuData] = await Promise.all([api.listSkuLocations(), api.listSkus()]);
      setLocations(data.locations || []);
      setSkus(skuData.skus || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startAdd() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setShowForm(true);
  }

  function startEdit(location) {
    setEditingId(location._id);
    setForm({ sku: location.sku?._id || location.sku || "", location: location.location || "" });
    setShowForm(true);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setShowForm(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!user) return setError("Log in to manage SKU locations.");
    setBusy(true);
    try {
      if (editingId) {
        await api.updateSkuLocation(editingId, form, token);
        showToast("SKU location updated successfully.");
      } else {
        await api.createSkuLocation(form, token);
        showToast("SKU location added successfully.");
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

  async function handleToggle(location) {
    setBusy(true);
    try {
      await api.updateSkuLocation(location._id, { enabled: !location.enabled }, token);
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this SKU location permanently?")) return;
    setBusy(true);
    try {
      await api.deleteSkuLocation(id, token);
      showToast("SKU location deleted successfully.");
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
      await api.downloadSkuLocations(format, token);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="space-y-5">
      <BulkUploadModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        initialMasterType="sku-location"
        onSuccess={load}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => handleExport("csv")} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Export CSV
        </button>
        <button type="button" onClick={() => handleExport("xlsx")} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Export Excel
        </button>
        <button type="button" onClick={() => setShowBulkModal(true)} className="rounded-md border border-teal-700 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50">
          Add Bulk Location
        </button>
        <button type="button" onClick={startAdd} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          Add SKU Location
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">{editingId ? "Edit SKU Location" : "Add SKU Location"}</h2>
              <button type="button" onClick={cancelEdit} aria-label="Close" className="text-xl font-bold leading-none text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <SearchableSelect
                value={form.sku}
                onChange={(value) => setForm((current) => ({ ...current, sku: value }))}
                options={skus.map((sku) => ({ value: sku._id, label: sku.name }))}
                placeholder="Search and select SKU"
                required
              />
              <input required placeholder="Location" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={cancelEdit} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium">Cancel</button>
                <button type="submit" disabled={busy} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {editingId ? "Save changes" : "Add location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <p className="text-sm text-gray-500">Loading...</p> : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Enabled</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => (
                <tr key={location._id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{location.sku?.name || "-"}</td>
                  <td className="px-4 py-2">{location.location}</td>
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => handleToggle(location)} disabled={busy}
                      className={`rounded px-2 py-1 text-xs font-medium ${location.enabled ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                      {location.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td className="space-x-2 px-4 py-2">
                    <button type="button" onClick={() => startEdit(location)} title="Edit SKU location" aria-label="Edit SKU location" className="text-blue-600 hover:underline"><img src="/icons/edit.svg" alt="" className="h-4 w-4" /></button>
                    <button type="button" onClick={() => handleDelete(location._id)} disabled={busy} title="Delete SKU location" aria-label="Delete SKU location" className="text-red-500 hover:underline"><img src="/icons/delete.svg" alt="" className="h-4 w-4" /></button>
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
