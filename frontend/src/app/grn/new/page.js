"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import SearchableSelect from "@/components/SearchableSelect";

export default function NewGrnPage() {
  const router = useRouter();
  const [editId, setEditId] = useState(undefined);
  const { token, user, showToast } = useApp();
  const [mode, setMode] = useState("manual"); // "manual" or "ai"
  const [openPos, setOpenPos] = useState([]);
  const [skus, setSkus] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [grnDate, setGrnDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState("");
  const [purchaseInvoiceDate, setPurchaseInvoiceDate] = useState("");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // AI upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [aiParsedResult, setAiParsedResult] = useState(null);

  useEffect(() => {
    const currentEditId = new URLSearchParams(window.location.search).get("edit");
    setEditId(currentEditId);
    Promise.all([
      api.listOpenPurchaseOrders(),
      api.listSkus(true),
      api.listParties("supplier"),
      currentEditId ? api.getGrn(currentEditId) : Promise.resolve(null),
    ]).then(([poData, skuData, partyData, grnData]) => {
      setOpenPos(poData.purchaseOrders || []);
      setSkus(skuData.skus || []);
      setSuppliers(partyData.parties || []);
      if (grnData) {
        const grn = grnData.grn;
        setSelectedPoId(grn.purchaseOrder?._id || grn.purchaseOrder || "");
        setGrnDate(new Date(grn.grnDate).toISOString().slice(0, 10));
        setPurchaseInvoiceNumber(grn.purchaseInvoiceNumber || "");
        setPurchaseInvoiceDate(new Date(grn.purchaseInvoiceDate).toISOString().slice(0, 10));
        setItems(grn.items.map((item) => ({ ...item, qtyOrdered: item.qtyOrdered, qtyReceived: String(item.qtyReceived), mrp: String(item.mrp), rate: String(item.rate), gstRate: String(item.gstRate || 0) })));
      }
    }).catch((e) => setError(e.message));
  }, []);

  function handleSelectPo(poId) {
    setSelectedPoId(poId);
    const po = openPos.find((p) => p._id === poId);
    if (!po) return setItems([]);
    setItems(
      po.items.filter((i) => i.pendingQty > 0).map((i) => ({
        sku: i.sku,
        skuName: i.skuName,
        qtyOrdered: i.pendingQty,
        qtyReceived: i.pendingQty,
        batch: "",
        expiryDate: "",
        mrp: "",
        rate: i.rate,
        gstRate: i.gstRate ?? "0",
      }))
    );
  }

  const selectedPo = openPos.find((po) => po._id === selectedPoId);

  async function handleFileUploadAndParse(e) {
    e.preventDefault();
    if (!uploadFile) return setError("Please select an invoice file to upload.");
    setError("");
    setParsing(true);
    setAiParsedResult(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const result = await api.parseInvoice(formData, token);
      setAiParsedResult(result);

      // Pre-fill form values
      if (result.purchaseOrder?.matchedPurchaseOrderId) {
        handleSelectPo(result.purchaseOrder.matchedPurchaseOrderId);
      } else if (result.vendor?.matchedPartyId) {
        const vendorPo = openPos.find(p => p.supplier === result.vendor.matchedPartyId || p.supplier?._id === result.vendor.matchedPartyId);
        if (vendorPo) handleSelectPo(vendorPo._id);
      }

      if (result.invoice?.number) setPurchaseInvoiceNumber(result.invoice.number);
      if (result.invoice?.date) setPurchaseInvoiceDate(result.invoice.date);

      // Map extracted line items
      if (result.items && result.items.length > 0) {
        const mappedItems = result.items.map((extractedItem) => {
          const matchedSku = skus.find((s) => s._id === extractedItem.matchedSkuId);
          return {
            sku: extractedItem.matchedSkuId || "",
            skuName: matchedSku?.name || extractedItem.description || extractedItem.skuCode || "Unmatched SKU",
            qtyOrdered: extractedItem.quantity || 1,
            qtyReceived: String(extractedItem.quantity || 1),
            freeQuantity: extractedItem.freeQuantity || 0,
            batch: extractedItem.batchNumber || "",
            expiryDate: extractedItem.expiryDate || "",
            mrp: String(extractedItem.unitPrice ? (extractedItem.unitPrice * 1.2).toFixed(2) : "0"),
            rate: String(extractedItem.unitPrice || "0"),
            gstRate: String(extractedItem.taxRate || "0"),
            confidence: extractedItem.confidence ?? 0,
            rawExtracted: extractedItem,
          };
        });
        setItems(mappedItems);
      }
      showToast("Invoice parsed successfully. Please review the extracted draft.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setParsing(false);
    }
  }

  function handleItemChange(index, field, value) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "sku") {
        const selectedSku = skus.find((s) => s._id === value);
        if (selectedSku) {
          next[index].skuName = selectedSku.name;
        }
      }
      return next;
    });
  }

  function handleAddItem() {
    setItems((prev) => [
      ...prev,
      {
        sku: "",
        skuName: "",
        qtyOrdered: 1,
        qtyReceived: "1",
        freeQuantity: 0,
        batch: "",
        expiryDate: "",
        mrp: "0",
        rate: "0",
        gstRate: "0",
        confidence: 1,
      },
    ]);
  }

  function handleRemoveItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!user) return setError("Log in to create a GRN.");
    if (!selectedPoId) return setError("Select a purchase order.");
    if (!purchaseInvoiceNumber.trim()) return setError("Enter the purchase invoice number.");
    if (!purchaseInvoiceDate) return setError("Select the purchase invoice date.");
    if (items.some((i) => !i.sku)) return setError("All items must have a valid SKU selected.");

    setLoading(true);
    try {
      const payload = {
        purchaseOrderId: selectedPoId,
        grnDate,
        purchaseInvoiceNumber: purchaseInvoiceNumber.trim(),
        purchaseInvoiceDate,
        items: items.map((i) => ({
          sku: i.sku,
          skuName: i.skuName,
          qtyOrdered: Number(i.qtyOrdered) || 0,
          qtyReceived: Number(i.qtyReceived) || 0,
          batch: i.batch,
          expiryDate: i.expiryDate,
          mrp: Number(i.mrp) || 0,
          rate: Number(i.rate) || 0,
          gstRate: Number(i.gstRate) || 0,
        })),
      };
      const data = editId ? await api.updateGrn(editId, payload, token) : await api.createGrn(payload, token);
      showToast(editId ? "GRN updated successfully." : "Draft GRN saved successfully.");
      router.push(`/grn/${data.grn._id}`);
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-xl font-semibold">{editId ? "Edit GRN" : "New GRN"}</h1>
        {!editId && (
          <div className="flex gap-2 text-sm bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${mode === "manual" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Manual Entry
            </button>
            <button
              type="button"
              onClick={() => setMode("ai")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${mode === "ai" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Upload Invoice (AI Draft)
            </button>
          </div>
        )}
      </div>

      {!editId && mode === "ai" && !aiParsedResult && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 space-y-4 text-center">
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-base font-medium text-gray-800">Upload Purchase Invoice Document</h2>
            <p className="text-xs text-gray-500">Supports PDF, JPG, JPEG, and PNG (up to 10MB)</p>
          </div>
          <form onSubmit={handleFileUploadAndParse} className="max-w-md mx-auto space-y-3">
            <input
              type="file"
              accept=".pdf,image/jpeg,image/jpg,image/png"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-900 file:text-white hover:file:bg-gray-800 cursor-pointer"
            />
            <button
              type="submit"
              disabled={parsing || !uploadFile}
              className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {parsing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Processing Invoice with AI/OCR...
                </span>
              ) : (
                "Extract Invoice Data"
              )}
            </button>
          </form>
        </div>
      )}

      {aiParsedResult && (
        <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-900">AI Extraction Summary</h3>
            <span className={`text-xs px-2 py-1 rounded font-medium ${aiParsedResult.overallConfidence >= 0.8 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
              Overall Confidence: {Math.round((aiParsedResult.overallConfidence || 0) * 100)}%
            </span>
          </div>

          {aiParsedResult.warnings && aiParsedResult.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 space-y-1">
              <span className="font-semibold block mb-1">Warnings / Unmatched Fields:</span>
              <ul className="list-disc list-inside space-y-1">
                {aiParsedResult.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {(mode === "manual" || aiParsedResult || editId) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Purchase Order</label>
              <SearchableSelect
                value={selectedPoId}
                onChange={handleSelectPo}
                options={openPos.map((po) => ({ value: po._id, label: `${po.poNumber} - ${po.supplierName}` }))}
                placeholder="Select a PO awaiting receipt"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">GRN Date</label>
              <input required type="date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Supplier
                {aiParsedResult?.vendor?.confidence < 0.7 && (
                  <span className="text-xs text-amber-600 font-normal ml-2">(Low confidence extraction)</span>
                )}
              </label>
              <div className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50">
                {selectedPo?.supplier?.name || selectedPo?.supplierName || aiParsedResult?.vendor?.name || "Select a purchase order"}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Purchase Invoice Number
                {aiParsedResult?.invoice?.confidence < 0.7 && (
                  <span className="text-xs text-amber-600 font-normal ml-2">(Low confidence)</span>
                )}
              </label>
              <input required type="text" value={purchaseInvoiceNumber} onChange={(e) => setPurchaseInvoiceNumber(e.target.value)}
                placeholder="Enter invoice number"
                className={`w-full border rounded-md px-3 py-2 text-sm ${aiParsedResult && (!purchaseInvoiceNumber || aiParsedResult.invoice?.confidence < 0.7) ? 'border-amber-400 bg-amber-50/30' : 'border-gray-300'}`} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Purchase Invoice Date
              </label>
              <input required type="date" value={purchaseInvoiceDate} onChange={(e) => setPurchaseInvoiceDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-semibold">Line Items</h2>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 font-medium text-gray-700"
              >
                + Add Item
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">No items added yet. Click &quot;+ Add Item&quot; or select a PO.</p>
            ) : (
              <div className="space-y-3">
                <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                  <div className="col-span-3">SKU / Product</div>
                  <div className="col-span-2">Batch Number</div>
                  <div className="col-span-2">Expiry Date</div>
                  <div className="col-span-1">MRP</div>
                  <div className="col-span-1">Rate</div>
                  <div className="col-span-1">GST %</div>
                  <div className="col-span-1">Qty Recv</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>

                {items.map((item, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2 rounded-md border ${
                      item.confidence && item.confidence < 0.7 ? "border-amber-300 bg-amber-50/20" : "border-gray-200"
                    }`}
                  >
                    <div className="col-span-3">
                      <SearchableSelect
                        value={item.sku}
                        onChange={(val) => handleItemChange(i, "sku", val)}
                        options={skus.map((s) => ({ value: s._id, label: `${s.code ? s.code + " - " : ""}${s.name}` }))}
                        placeholder="Select SKU"
                        required
                      />
                      {item.rawExtracted?.description && item.skuName !== item.rawExtracted.description && (
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">Extracted: &quot;{item.rawExtracted.description}&quot;</p>
                      )}
                    </div>

                    <input
                      required
                      placeholder="Batch"
                      value={item.batch}
                      onChange={(e) => handleItemChange(i, "batch", e.target.value)}
                      className="col-span-2 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    />

                    <input
                      required
                      type="date"
                      value={item.expiryDate}
                      onChange={(e) => handleItemChange(i, "expiryDate", e.target.value)}
                      className="col-span-2 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    />

                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="MRP"
                      value={item.mrp}
                      onChange={(e) => handleItemChange(i, "mrp", e.target.value)}
                      className="col-span-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    />

                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Rate"
                      value={item.rate}
                      onChange={(e) => handleItemChange(i, "rate", e.target.value)}
                      className="col-span-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    />

                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      placeholder="GST %"
                      value={item.gstRate}
                      onChange={(e) => handleItemChange(i, "gstRate", e.target.value)}
                      className="col-span-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    />

                    <input
                      required
                      type="number"
                      min="0"
                      value={item.qtyReceived}
                      onChange={(e) => handleItemChange(i, "qtyReceived", e.target.value)}
                      className="col-span-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                    />

                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(i)}
                        className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-2.5 rounded border border-red-200">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || items.length === 0}
              className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Draft GRN"}
            </button>
            <a href="/grn" className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </a>
          </div>
        </form>
      )}
    </div>
  );
}
