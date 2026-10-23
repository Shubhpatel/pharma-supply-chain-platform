"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import BulkUploadModal from "@/components/BulkUploadModal";

const BLANK_FORM = {
  name: "",
  gstNumber: "",
  contactPerson: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
};

export default function PartyManager({ type, title }) {
  const { user, token, showToast } = useApp();
  const [parties, setParties] = useState([]);
  const [form, setForm] = useState(BLANK_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listParties(type);
      setParties(data.parties);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(party) {
    setEditingId(party._id);
    setShowForm(true);
    setForm(Object.fromEntries(Object.keys(BLANK_FORM).map((key) => [key, party[key] || ""])));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(BLANK_FORM);
    setShowForm(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!user) return setError("Log in to manage masters.");
    setBusy(true);
    try {
      const payload = { ...form, partyType: type };
      if (editingId) {
        await api.updateParty(editingId, payload, token);
        showToast(`${title} updated successfully.`);
      } else {
        await api.createParty(payload, token);
        showToast(`${title} added successfully.`);
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

  async function handleDelete(id) {
    if (!confirm(`Delete this ${title.toLowerCase()} permanently?`)) return;
    setBusy(true);
    try {
      await api.deleteParty(id, token);
      showToast(`${title} deleted successfully.`);
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const fields = [
    ["name", "Name", true],
    ["gstNumber", "GST number", false],
    ["contactPerson", "Contact person", false],
    ["phone", "Phone", false],
    ["email", "Email", false],
    ["addressLine1", "Address line 1", true],
    ["addressLine2", "Address line 2", false],
    ["city", "City", false],
    ["state", "State", false],
    ["postalCode", "Postal code", false],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-3">
        {!editingId && (
          <>
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="px-4 py-2 rounded-md border border-teal-700 text-teal-800 text-sm font-medium hover:bg-teal-50"
            >
              Add Bulk
            </button>
            <button type="button" onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium">
              Add {title}
            </button>
          </>
        )}
      </div>

      <BulkUploadModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        initialMasterType={type}
        onSuccess={load}
      />

      {(showForm || editingId) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">{editingId ? `Edit ${title}` : `Add ${title}`}</h2>
              <button type="button" onClick={cancelEdit} aria-label="Close" className="text-xl font-bold leading-none text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map(([field, placeholder, required]) => (
                  <input key={field} required={required} type={field === "email" ? "email" : "text"}
                    placeholder={placeholder} value={form[field]} onChange={(event) => updateField(field, event.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium">Cancel</button>
                <button type="submit" disabled={busy}
                  className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium disabled:opacity-50">
                  {editingId ? "Save changes" : `Add ${title}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <p className="text-sm text-gray-500">Loading...</p> : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Master UID</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">GST number</th>
                <th className="px-4 py-2">Contact</th>
                <th className="px-4 py-2">Phone</th>
                <th className="px-4 py-2">City</th>
                <th className="px-4 py-2">State</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((party) => (
                <tr key={party._id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{party.uid || "-"}</td>
                  <td className="px-4 py-2 font-medium">{party.name}</td>
                  <td className="px-4 py-2">{party.gstNumber || "-"}</td>
                  <td className="px-4 py-2">{party.contactPerson || "-"}</td>
                  <td className="px-4 py-2">{party.phone || "-"}</td>
                  <td className="px-4 py-2">{party.city || "-"}</td>
                  <td className="px-4 py-2">{party.state || "-"}</td>
                  <td className="px-4 py-2 space-x-3">
                    <button onClick={() => startEdit(party)} title={`Edit ${title}`} aria-label={`Edit ${title}`} className="text-blue-600 hover:underline"><img src="/icons/edit.svg" alt="" className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(party._id)} disabled={busy} title={`Delete ${title}`} aria-label={`Delete ${title}`} className="text-red-500 hover:underline"><img src="/icons/delete.svg" alt="" className="h-4 w-4" /></button>
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
