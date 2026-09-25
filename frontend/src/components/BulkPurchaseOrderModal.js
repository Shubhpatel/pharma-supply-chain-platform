"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

export default function BulkPurchaseOrderModal({ isOpen, onClose, onSuccess }) {
  const { token, showToast } = useApp();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [failedUploadId, setFailedUploadId] = useState(null);

  if (!isOpen) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMsg("");
    setFailedUploadId(null);
    if (!file) return setErrorMsg("Please select a CSV or Excel file to upload.");

    const formData = new FormData();
    formData.append("file", file);
    setBusy(true);
    try {
      const result = await api.uploadBulkPurchaseOrders(formData, token);
      showToast(result.message || "Purchase orders imported successfully.");
      setFile(null);
      onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
      setFailedUploadId(err.bulkUploadId || null);
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg space-y-5 rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Bulk Purchase Orders</h2>
            <p className="mt-1 text-xs text-gray-500">Use one row per SKU line. Enter Vendor UID or Supplier name, and Product UID or SKU name. If both are entered, they must match.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-xl font-bold leading-none text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <div className="rounded-lg border border-teal-100 bg-teal-50/60 p-3">
          <p className="mb-2 text-xs font-medium text-teal-800">Download the required template</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => api.downloadPurchaseOrderSample("csv")} className="rounded border border-teal-300 bg-white px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100">Sample CSV</button>
            <button type="button" onClick={() => api.downloadPurchaseOrderSample("xlsx")} className="rounded border border-teal-300 bg-white px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100">Sample Excel</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs font-semibold uppercase text-gray-600">
            Upload File (.csv, .xlsx, .xls)
            <input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => setFile(event.target.files[0] || null)} className="mt-1 w-full text-sm font-normal normal-case text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-teal-700 hover:file:bg-teal-100" />
          </label>

          {errorMsg && (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <p>{errorMsg}</p>
              {failedUploadId && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Download error file:</span>
                  <button type="button" onClick={() => api.downloadErrorFile(failedUploadId, "csv", token)} className="rounded border border-red-300 bg-red-100 px-2 py-1 font-medium text-red-800 hover:bg-red-200">CSV</button>
                  <button type="button" onClick={() => api.downloadErrorFile(failedUploadId, "xlsx", token)} className="rounded border border-red-300 bg-red-100 px-2 py-1 font-medium text-red-800 hover:bg-red-200">Excel</button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={busy || !file} className="rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50">{busy ? "Importing..." : "Upload & Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
