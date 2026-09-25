"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

export default function BulkUploadModal({ isOpen, onClose, initialMasterType = "sku", onSuccess }) {
  const { token, showToast } = useApp();
  const [masterType, setMasterType] = useState(initialMasterType);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [failedUploadId, setFailedUploadId] = useState(null);

  if (!isOpen) return null;

  function handleDownloadSample(format) {
    api.downloadSampleFile(masterType, format);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setFailedUploadId(null);

    if (!file) {
      return setErrorMsg("Please select a CSV or Excel file to upload.");
    }

    const formData = new FormData();
    formData.append("masterType", masterType);
    formData.append("file", file);

    setBusy(true);
    try {
      const res = await api.uploadBulkMaster(formData, token);
      showToast(res.message || "Bulk upload completed successfully.");
      setFile(null);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
      if (err.bulkUploadId) {
        setFailedUploadId(err.bulkUploadId);
      }
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadErrorFile(format) {
    if (failedUploadId) {
      api.downloadErrorFile(failedUploadId, format, token);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">{masterType === "sku-location" ? "Add Bulk SKU Locations" : "Add Bulk Masters"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
              Select Master Type
            </label>
            <select
              value={masterType}
              onChange={(e) => setMasterType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-600 outline-none"
            >
              <option value="sku">SKU Master</option>
              <option value="sku-location">SKU Location</option>
              <option value="vendor">Vendor Master</option>
              <option value="customer">Customer Master</option>
            </select>
          </div>

          {/* Download Sample File section */}
          <div className="rounded-lg bg-teal-50/60 p-3 border border-teal-100 space-y-2">
            <span className="block text-xs font-medium text-teal-800">
              Download Sample Template ({masterType.toUpperCase()})
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDownloadSample("csv")}
                className="px-3 py-1.5 rounded bg-white text-teal-800 border border-teal-300 hover:bg-teal-100 text-xs font-medium"
              >
                Sample CSV
              </button>
              <button
                type="button"
                onClick={() => handleDownloadSample("xlsx")}
                className="px-3 py-1.5 rounded bg-white text-teal-800 border border-teal-300 hover:bg-teal-100 text-xs font-medium"
              >
                Sample Excel (.xlsx)
              </button>
            </div>
          </div>

          {/* File input */}
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
              Upload File (.csv, .xlsx, .xls)
            </label>
            <input
              type="file"
              accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={(e) => setFile(e.target.files[0] || null)}
              className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
            />
          </div>

          {errorMsg && (
            <div className="rounded-md bg-red-50 p-3 border border-red-200 text-xs text-red-700 space-y-2">
              <p className="font-medium">{errorMsg}</p>
              {failedUploadId && (
                <div className="pt-1 flex items-center gap-2">
                  <span className="font-semibold text-red-800">Download Error File:</span>
                  <button
                    type="button"
                    onClick={() => handleDownloadErrorFile("csv")}
                    className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-medium text-xs border border-red-300"
                  >
                    Error CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadErrorFile("xlsx")}
                    className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-medium text-xs border border-red-300"
                  >
                    Error Excel
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !file}
              className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-medium hover:bg-teal-900 disabled:opacity-50"
            >
              {busy ? "Uploading..." : "Upload & Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
