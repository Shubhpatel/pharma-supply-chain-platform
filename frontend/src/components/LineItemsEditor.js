"use client";

import { useCallback, useEffect } from "react";
import SearchableSelect from "./SearchableSelect";

export default function LineItemsEditor({ items, setItems, skus, inventory = [], includeBatch = false }) {
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
    setItems((prev) => [...prev, { sku: "", skuName: "", batch: "", expiryDate: "", mrp: "", qty: "", rate: "" }]);
  }

  function removeRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const skuCol = includeBatch ? "col-span-3" : "col-span-5";
  const qtyCol = includeBatch ? "col-span-1" : "col-span-2";
  const rateCol = includeBatch ? "col-span-1" : "col-span-2";
  const amountCol = includeBatch ? "col-span-1" : "col-span-2";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
        <div className={skuCol}>SKU</div>
        {includeBatch && <div className="col-span-2">Batch</div>}
        {includeBatch && <div className="col-span-2">Expiry</div>}
        {includeBatch && <div className="col-span-2">MRP</div>}
        <div className={qtyCol}>Qty</div>
        <div className={rateCol}>Rate</div>
        <div className={amountCol}>Amount</div>
        <div className="col-span-1"></div>
      </div>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <SearchableSelect
            value={item.sku}
            onChange={(value) => updateItem(i, "sku", value)}
            options={skus.map((sku) => ({ value: sku._id, label: sku.name }))}
            placeholder="Select SKU"
            required
            className={skuCol}
          />
          {includeBatch && (
            <input required placeholder="Batch" value={item.batch}
              onChange={(e) => updateItem(i, "batch", e.target.value)}
              className="col-span-2 border border-gray-300 rounded-md px-2 py-2 text-sm" />
          )}
          {includeBatch && (
            <input required type="date" value={item.expiryDate}
              onChange={(e) => updateItem(i, "expiryDate", e.target.value)}
              className="col-span-2 border border-gray-300 rounded-md px-2 py-2 text-sm" />
          )}
          {includeBatch && (
            <input required type="number" min="0" step="0.01" placeholder="MRP" value={item.mrp}
              onChange={(e) => updateItem(i, "mrp", e.target.value)}
              className="col-span-2 border border-gray-300 rounded-md px-2 py-2 text-sm" />
          )}
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
      <button type="button" onClick={addRow} className="text-sm text-blue-600 hover:underline">+ Add line item</button>
    </div>
  );
}
