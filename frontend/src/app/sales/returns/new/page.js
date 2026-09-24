"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";

export default function NewCreditNotePage() {
  const router = useRouter();
  const { token, showToast } = useApp();
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingInvoice, setFetchingInvoice] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listInvoices().then((d) => setInvoices(d.invoices || [])).catch((e) => setError(e.message));
  }, []);

  async function handleInvoiceSelect(invoiceId) {
    setSelectedInvoiceId(invoiceId);
    if (!invoiceId) {
      setSelectedInvoice(null);
      setItems([]);
      return;
    }
    setFetchingInvoice(true);
    setError("");
    try {
      const data = await api.getInvoice(invoiceId);
      const invoice = data.invoice;
      setSelectedInvoice(invoice);

      // Initialize return items based on Sale Invoice items
      setItems(
        invoice.items.map((si) => ({
          sku: si.sku,
          skuName: si.skuName,
          batch: si.batch,
          expiryDate: si.expiryDate,
          mrp: si.mrp,
          rate: si.rate,
          invoiceQty: si.qty,
          returnQty: 0,
          gstRate: si.gstRate || 0,
        }))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setFetchingInvoice(false);
    }
  }

  function handleQtyChange(index, value) {
    const newItems = [...items];
    const val = Math.max(0, Number(value) || 0);
    newItems[index].returnQty = Math.min(val, newItems[index].invoiceQty);
    setItems(newItems);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedInvoiceId) {
      setError("Please select a Sales Invoice");
      return;
    }

    const validItems = items
      .filter((i) => i.returnQty > 0)
      .map((i) => ({
        sku: i.sku,
        skuName: i.skuName,
        batch: i.batch,
        qty: i.returnQty,
      }));

    if (validItems.length === 0) {
      setError("Please enter a return quantity > 0 for at least one item");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await api.createCreditNote(
        {
          invoiceId: selectedInvoiceId,
          returnDate,
          reason,
          items: validItems,
        },
        token
      );
      showToast(`Credit Note ${res.creditNote.creditNoteNumber} created successfully!`);
      router.push(`/sales/returns/${res.creditNote._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const calculatedTotalQty = items.reduce((sum, i) => sum + (Number(i.returnQty) || 0), 0);
  const calculatedTotalAmount = items.reduce((sum, i) => sum + (Number(i.returnQty) || 0) * i.rate, 0);
  const calculatedGstAmount = items.reduce(
    (sum, i) => sum + ((Number(i.returnQty) || 0) * i.rate * (i.gstRate || 0)) / 100,
    0
  );
  const calculatedGrandTotal = calculatedTotalAmount + calculatedGstAmount;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Create Sales Return (Credit Note)</h1>
        <p className="text-sm text-gray-500">Record goods returned by customer against a Sales Invoice</p>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Select Sales Invoice *</label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => handleInvoiceSelect(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-teal-600"
            >
              <option value="">-- Select Sales Invoice --</option>
              {invoices.map((inv) => (
                <option key={inv._id} value={inv._id}>
                  {inv.invoiceNumber} - {inv.customerName} ({new Date(inv.saleDate).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Return Date *</label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-teal-600"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Reason for Return</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer returned, Damaged packaging, Wrong item"
              className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-teal-600"
            />
          </div>
        </div>

        {fetchingInvoice && <p className="text-sm text-gray-500">Loading invoice items...</p>}

        {selectedInvoice && (
          <div className="space-y-4 border-t border-gray-200 pt-4">
            <div className="text-sm text-gray-600 grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-md">
              <div><span className="font-medium">Customer:</span> {selectedInvoice.customerName}</div>
              <div><span className="font-medium">Sale Date:</span> {new Date(selectedInvoice.saleDate).toLocaleDateString()}</div>
            </div>

            <h2 className="text-sm font-semibold text-gray-800">Return Items</h2>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Batch</th>
                    <th className="px-3 py-2">Invoice Qty</th>
                    <th className="px-3 py-2">Return Qty</th>
                    <th className="px-3 py-2">Rate</th>
                    <th className="px-3 py-2">GST</th>
                    <th className="px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => {
                    const itemAmt = (Number(item.returnQty) || 0) * item.rate;
                    return (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-medium">{item.skuName}</td>
                        <td className="px-3 py-2">{item.batch}</td>
                        <td className="px-3 py-2">{item.invoiceQty}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            max={item.invoiceQty}
                            value={item.returnQty}
                            onChange={(e) => handleQtyChange(idx, e.target.value)}
                            className="w-20 rounded border border-gray-300 px-2 py-1 outline-none focus:border-teal-600"
                          />
                        </td>
                        <td className="px-3 py-2">₹{item.rate.toFixed(2)}</td>
                        <td className="px-3 py-2">{item.gstRate}%</td>
                        <td className="px-3 py-2 font-medium">₹{itemAmt.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-gray-200 font-medium bg-gray-50">
                  <tr>
                    <td colSpan="3" className="px-3 py-2 text-right">Totals:</td>
                    <td className="px-3 py-2">{calculatedTotalQty}</td>
                    <td></td>
                    <td className="px-3 py-2">₹{calculatedGstAmount.toFixed(2)}</td>
                    <td className="px-3 py-2">₹{calculatedGrandTotal.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
          <a
            href="/sales/returns"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={loading || !selectedInvoice}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-md hover:bg-teal-800 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Save Credit Note"}
          </button>
        </div>
      </form>
    </div>
  );
}
