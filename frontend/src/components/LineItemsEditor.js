"use client";

export default function LineItemsEditor({ items, setItems, skus }) {
  function updateItem(index, field, value) {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === "sku") {
        const chosen = skus.find((s) => s._id === value);
        item.skuName = chosen ? chosen.name : "";
      }
      next[index] = item;
      return next;
    });
  }

  function addRow() {
    setItems((prev) => [...prev, { sku: "", skuName: "", qty: "", rate: "" }]);
  }

  function removeRow(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
        <div className="col-span-5">SKU</div>
        <div className="col-span-2">Qty</div>
        <div className="col-span-2">Rate</div>
        <div className="col-span-2">Amount</div>
        <div className="col-span-1"></div>
      </div>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <select required value={item.sku} onChange={(e) => updateItem(i, "sku", e.target.value)}
            className="col-span-5 border border-gray-300 rounded-md px-2 py-2 text-sm">
            <option value="" disabled>Select SKU</option>
            {skus.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          <input required type="number" min="1" placeholder="Qty" value={item.qty}
            onChange={(e) => updateItem(i, "qty", e.target.value)}
            className="col-span-2 border border-gray-300 rounded-md px-2 py-2 text-sm" />
          <input required type="number" min="0" step="0.01" placeholder="Rate" value={item.rate}
            onChange={(e) => updateItem(i, "rate", e.target.value)}
            className="col-span-2 border border-gray-300 rounded-md px-2 py-2 text-sm" />
          <div className="col-span-2 text-sm text-gray-600">
            {item.qty && item.rate ? (Number(item.qty) * Number(item.rate)).toFixed(2) : "-"}
          </div>
          <button type="button" onClick={() => removeRow(i)} className="col-span-1 text-red-500 text-sm">✕</button>
        </div>
      ))}
      <button type="button" onClick={addRow} className="text-sm text-blue-600 hover:underline">+ Add line item</button>
    </div>
  );
}
