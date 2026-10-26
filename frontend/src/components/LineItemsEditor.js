"use client";

import { useCallback, useEffect, useMemo } from "react";
import SearchableSelect from "./SearchableSelect";

export default function LineItemsEditor({ items, setItems, skus, inventory = [], includeBatch = false, onSearchSkus }) {
  // ⚡ Bolt: Memoize SKU options mapping to avoid O(N*M) array allocations on every render/keystroke
  const skuOptions = useMemo(
    () => skus.map((sku) => ({ value: sku._id, label: sku.name })),
    [skus]
  );
  const applyPreferredStock = useCallback((item) => {
    if (!item.sku) return { ...item, batch: "", expiryDate: "", mrp: "" };

    const stockRows = inventory
      .filter((row) => row.skuId === item.sku && Number(row.qty) > 0)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    const preferredStock = stockRows[0];
    if (!preferredStock) {
      return { ...item, batch: "", expiryDate: "", mrp: "" };
    }

    return {
      ...item,
      batch: preferredStock.batch || "",
      expiryDate: preferredStock.expiryDate ? new Date(preferredStock.expiryDate).toISOString().slice(0, 10) : "",
      mrp: preferredStock.mrp ?? "",
    };
  }, [inventory]);

  function updateItem(index, field, value) {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === "sku") {
        const chosen = skus.find((s) => s._id === value);
        item.skuName = chosen ? chosen.name : "";
        const stockFilledItem = applyPreferredStock(item);
        next[index] = stockFilledItem;
        return next;
      }
      if (field === "batch" && includeBatch) {
        const selectedStock = inventory.find((row) => row.skuId === item.sku && row.batch === value && Number(row.qty) > 0);
        if (selectedStock) {
          item.expiryDate = selectedStock.expiryDate ? new Date(selectedStock.expiryDate).toISOString().slice(0, 10) : "";
          item.mrp = selectedStock.mrp ?? "";
        }
      }
      next[index] = item;
      return next;
    });
  }

  useEffect(() => {
    setItems((prev) => prev.map((item) => {
      if (!item.sku || item.batch || item.expiryDate || item.mrp) return item;
      return applyPreferredStock(item);
    }));
  }, [applyPreferredStock, setItems]);

  function addRow() {
    setItems((prev) => [...prev, { sku: "", skuName: "", batch: "", expiryDate: "", mrp: "", qty: "", rate: "", gstRate: "0" }]);
  }

  function removeRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function stockOnHand(item) {
    return inventory
      .filter((row) => row.skuId === item.sku && row.batch === item.batch)
      .reduce((sum, row) => sum + Number(row.qty || 0), 0);
  }

  const gridClass = includeBatch
    ? "grid-cols-[repeat(14,minmax(0,1fr))]"
    : "grid-cols-12";
  const skuCol = includeBatch ? "col-span-3" : "col-span-5";
  const qtyCol = includeBatch ? "col-span-1" : "col-span-2";
  const rateCol = includeBatch ? "col-span-1" : "col-span-2";
  const amountCol = "col-span-1";
  const gstCol = "col-span-1";
  const sohCol = "col-span-1";
  const mrpCol = includeBatch ? "col-span-1" : "col-span-2";

  return (
    <div className="min-w-0 space-y-2">
      <div className="overflow-x-auto">
        <div className={`grid min-w-[1050px] ${gridClass} gap-2 px-1 text-xs font-medium text-gray-500`}>
        <div className={skuCol}>SKU</div>
        {includeBatch && <div className="col-span-2">Batch</div>}
        {includeBatch && <div className="col-span-2">Expiry</div>}
        {includeBatch && <div className={mrpCol}>MRP</div>}
        <div className={gstCol}>GST</div>
        {includeBatch && <div className={sohCol}>SOH</div>}
        <div className={qtyCol}>Qty</div>
        <div className={rateCol}>Rate</div>
        <div className={amountCol}>Amount</div>
        <div className="col-span-1"></div>
        </div>
      </div>
      <div className="overflow-x-auto">
        {items.map((item, i) => (
          <div key={i} className={`grid min-w-[1050px] ${gridClass} items-center gap-2`}>
          <SearchableSelect
            value={item.sku}
            onChange={(value) => updateItem(i, "sku", value)}
            options={skuOptions}
            onSearch={onSearchSkus}
            placeholder="Select SKU"
            required
            className={skuCol}
          />
          {includeBatch && (
            <select required value={item.batch}
              onChange={(e) => updateItem(i, "batch", e.target.value)}
              className="col-span-2 border border-gray-300 rounded-md px-2 py-2 text-sm">
              <option value="">Batch</option>
              {[...new Set(inventory
                .filter((row) => row.skuId === item.sku && Number(row.qty) > 0)
                .map((row) => row.batch))]
                .map((batch) => <option key={batch} value={batch}>{batch}</option>)}
            </select>
          )}
          {includeBatch && (
            <input required type="date" value={item.expiryDate}
              readOnly
              className="col-span-2 border border-gray-300 rounded-md px-2 py-2 text-sm bg-gray-50" />
          )}
          {includeBatch && (
            <input required type="number" min="0" step="0.01" placeholder="MRP" value={item.mrp}
              readOnly
              className={`${mrpCol} border border-gray-300 rounded-md px-2 py-2 text-sm bg-gray-50`} />
          )}
          <select required value={item.gstRate ?? "0"}
            onChange={(e) => updateItem(i, "gstRate", e.target.value)}
            className={`${gstCol} border border-gray-300 rounded-md px-2 py-2 text-sm`}>
            {[0, 5, 12, 18, 28].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
          </select>
          {includeBatch && <div className={`${sohCol} text-sm text-gray-500`}>{item.batch ? stockOnHand(item) : "-"}</div>}
          <input required type="number" min="1" placeholder="Qty" value={item.qty}
            onChange={(e) => updateItem(i, "qty", e.target.value)}
            className={`${qtyCol} border border-gray-300 rounded-md px-2 py-2 text-sm`} />
          <input required type="number" min="0" step="0.01" placeholder="Rate" value={item.rate}
            onChange={(e) => updateItem(i, "rate", e.target.value)}
            className={`${rateCol} border border-gray-300 rounded-md px-2 py-2 text-sm`} />
          <div className={`${amountCol} text-sm text-gray-600`}>
            {item.qty && item.rate ? (Number(item.qty) * Number(item.rate)).toFixed(2) : "-"}
          </div>
          <button type="button" onClick={() => removeRow(i)} className="col-span-1 text-red-500 text-sm">✕</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow} className="text-sm text-blue-600 hover:underline">+ Add line item</button>
    </div>
  );
}
