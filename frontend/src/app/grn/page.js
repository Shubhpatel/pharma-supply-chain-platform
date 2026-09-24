"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function GrnPage() {
  const [grns, setGrns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listGrns().then((d) => setGrns(d.grns)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">GRN</h1>
        <a href="/grn/new" className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium">+ Add GRN</a>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : grns.length === 0 ? (
        <p className="text-sm text-gray-500">No GRNs yet.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">GRN Number</th>
                <th className="px-4 py-2">PO Number</th>
                <th className="px-4 py-2">Supplier</th>
                <th className="px-4 py-2">GRN Date</th>
                <th className="px-4 py-2">Total Qty</th>
                <th className="px-4 py-2">Total Value</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {grns.map((g) => (
                <tr key={g._id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{g.grnNumber}</td>
                  <td className="px-4 py-2">{g.poNumber}</td>
                  <td className="px-4 py-2">{g.supplierName}</td>
                  <td className="px-4 py-2">{new Date(g.grnDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{g.totalQty}</td>
                  <td className="px-4 py-2">₹{g.totalValue.toFixed(2)}</td>
                  <td className="px-4 py-2 capitalize">{g.status}</td>
                  <td className="px-4 py-2"><a href={`/grn/${g._id}`} className="text-blue-600 hover:underline">View</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
