"use client";

import { useEffect, useState, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

export default function BulkUploadHistory({ onOpenModal }) {
  const { token, showToast } = useApp();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listBulkUploads(token);
      setHistory(data.history || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function handleDownloadError(id, format) {
    try {
      api.downloadErrorFile(id, format, token);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Bulk Generic Upload History</h2>
          <p className="text-xs text-gray-500">View history of all bulk data imports, statuses, and download error logs.</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenModal()}
          className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-medium hover:bg-teal-900"
        >
          Add Bulk Upload
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading history...</p>
      ) : history.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">No bulk uploads recorded yet.</p>
          <button
            type="button"
            onClick={() => onOpenModal()}
            className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-medium hover:bg-teal-900"
          >
            Start First Bulk Upload
          </button>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">File Name</th>
                <th className="px-4 py-3">Master Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total Rows</th>
                <th className="px-4 py-3">Success / Errors</th>
                <th className="px-4 py-3">Uploaded Date & Time</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.fileName}</td>
                  <td className="px-4 py-3 uppercase text-xs font-semibold text-gray-600">{item.masterType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        item.status === "done"
                          ? "bg-green-100 text-green-800"
                          : item.status === "error"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{item.totalRecords}</td>
                  <td className="px-4 py-3">
                    <span className="text-green-700 font-medium">{item.successRecords}</span>
                    {" / "}
                    <span className={item.errorRecords > 0 ? "text-red-600 font-medium" : "text-gray-500"}>
                      {item.errorRecords}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === "error" && item.errorRecords > 0 ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadError(item._id, "csv")}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Error CSV
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleDownloadError(item._id, "xlsx")}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Error Excel
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
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
