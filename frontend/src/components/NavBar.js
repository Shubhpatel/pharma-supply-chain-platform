"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

export default function NavBar() {
  const { user, logout, showToast } = useApp();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCatalog, setSearchCatalog] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  function handleLogout() {
    logout();
    showToast("Logged out successfully.");
  }

  useEffect(() => {
    if (!searchOpen || !user || searchCatalog.length > 0) return;

    setSearchLoading(true);
    Promise.allSettled([
      api.listPurchaseOrders(),
      api.listGrns(),
      api.listStock(),
      api.listInvoices(),
      api.listSkus(),
    ]).then(([purchaseResult, grnResult, stockResult, invoiceResult, skuResult]) => {
      const results = [];
      if (purchaseResult.status === "fulfilled") {
        results.push(...(purchaseResult.value.purchaseOrders || []).map((item) => ({
          key: `po-${item._id}`,
          type: "Purchase Order",
          title: item.poNumber,
          detail: item.supplierName,
          href: `/purchase/${item._id}`,
        })));
      }
      if (grnResult.status === "fulfilled") {
        results.push(...(grnResult.value.grns || []).map((item) => ({
          key: `grn-${item._id}`,
          type: "GRN",
          title: item.grnNumber,
          detail: item.supplierName,
          href: `/grn/${item._id}`,
        })));
      }
      if (stockResult.status === "fulfilled") {
        results.push(...(stockResult.value.stock || []).map((item, index) => ({
          key: `stock-${item.skuId}-${item.batch}-${index}`,
          type: "Inventory",
          title: item.name,
          detail: item.batch ? `Batch ${item.batch}` : item.category || "Stock",
          href: "/inventory",
        })));
      }
      if (invoiceResult.status === "fulfilled") {
        results.push(...(invoiceResult.value.invoices || []).map((item) => ({
          key: `invoice-${item._id}`,
          type: "Sales Invoice",
          title: item.invoiceNumber,
          detail: item.customerName,
          href: `/sales/${item._id}`,
        })));
      }
      if (skuResult.status === "fulfilled") {
        results.push(...(skuResult.value.skus || []).map((item) => ({
          key: `sku-${item._id}`,
          type: "SKU",
          title: item.name,
          detail: item.code || item.category || "Master",
          href: "/masters?tab=sku",
        })));
      }
      setSearchCatalog(results);
    }).finally(() => setSearchLoading(false));
  }, [searchOpen, searchCatalog.length, user]);

  const searchResults = searchCatalog
    .filter((item) => `${item.title} ${item.detail} ${item.type}`.toLowerCase().includes(searchQuery.toLowerCase()))
    .slice(0, 8);

  return (
    <nav className="border-b border-gray-200 bg-white/95 backdrop-blur print:hidden">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
        <a href="/" className="font-semibold text-lg tracking-tight text-teal-800">Pharma Buddy</a>
        {user && (
          <div className="flex items-center gap-1 text-sm">
            <div className="relative mr-1">
              <button
                type="button"
                onClick={() => { setSearchOpen((open) => !open); setPurchaseOpen(false); setSalesOpen(false); setMastersOpen(false); }}
                aria-expanded={searchOpen}
                className="rounded-md px-3 py-2 text-gray-600 hover:bg-teal-50 hover:text-teal-800"
              >
                Search
              </button>
              {searchOpen && (
                <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search orders, invoices, stock..."
                    aria-label="Global search"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-700"
                  />
                  <div className="mt-2 max-h-72 overflow-y-auto">
                    {searchLoading ? (
                      <p className="px-2 py-2 text-sm text-gray-500">Loading...</p>
                    ) : searchQuery.trim() === "" ? (
                      <p className="px-2 py-2 text-sm text-gray-500">Type to search across records.</p>
                    ) : searchResults.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-gray-500">No matches found.</p>
                    ) : (
                      searchResults.map((item) => (
                        <a
                          key={item.key}
                          href={item.href}
                          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                          className="block rounded-md px-2 py-2 hover:bg-teal-50"
                        >
                          <span className="block text-sm font-medium text-gray-800">{item.title}</span>
                          <span className="block text-xs text-gray-500">{item.type} · {item.detail}</span>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setPurchaseOpen((o) => !o); setSalesOpen(false); setMastersOpen(false); }}
                className="rounded-md px-3 py-2 text-gray-600 hover:bg-teal-50 hover:text-teal-800 flex items-center gap-1"
              >
                Purchase
              </button>
              {purchaseOpen && (
                <div className="absolute left-0 top-full z-10 mt-2 min-w-44 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                  <a href="/purchase" onClick={() => setPurchaseOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">Purchase Orders</a>
                  <a href="/grn" onClick={() => setPurchaseOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">GRN</a>
                  <a href="/purchase/returns" onClick={() => setPurchaseOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">Purchase Returns (Debit Note)</a>
                </div>
              )}
            </div>

            <a href="/inventory" className="rounded-md px-3 py-2 text-gray-600 hover:bg-teal-50 hover:text-teal-800">Inventory</a>

            <div className="relative">
              <button
                type="button"
                onClick={() => { setSalesOpen((o) => !o); setPurchaseOpen(false); setMastersOpen(false); }}
                className="rounded-md px-3 py-2 text-gray-600 hover:bg-teal-50 hover:text-teal-800 flex items-center gap-1"
              >
                Sales
              </button>
              {salesOpen && (
                <div className="absolute left-0 top-full z-10 mt-2 min-w-44 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                  <a href="/sales" onClick={() => setSalesOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">Sales Invoices</a>
                  <a href="/sales/returns" onClick={() => setSalesOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">Sales Returns (Credit Note)</a>
                </div>
              )}
            </div>

            <div className="relative">
              <button type="button" onClick={() => { setReportsOpen((open) => !open); setMastersOpen(false); }}
                className="rounded-md px-3 py-2 text-gray-600 hover:bg-teal-50 hover:text-teal-800">
                Reports
              </button>
              {reportsOpen && (
                <div className="absolute left-0 top-full z-10 mt-2 w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                  <a href="/reports?tab=sales" onClick={() => setReportsOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">Sales Report</a>
                  <a href="/reports?tab=grn" onClick={() => setReportsOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">GRN Report</a>
                  <a href="/reports?tab=near-expired" onClick={() => setReportsOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">Near Expired Report</a>
                  <a href="/reports?tab=expired" onClick={() => setReportsOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">Expired Report</a>
                  <a href="/reports?tab=po" onClick={() => setReportsOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">PO Report</a>
                  <a href="/reports?tab=slow-moving" onClick={() => setReportsOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">Slow Moving Report</a>
                  <a href="/reports?tab=non-moving" onClick={() => setReportsOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">Non Moving Report</a>
                </div>
              )}
            </div>
            <div className="relative">
              <button type="button" onClick={() => { setMastersOpen((open) => !open); setReportsOpen(false); }}
                className="rounded-md px-3 py-2 text-gray-600 hover:bg-teal-50 hover:text-teal-800">
                Masters
              </button>
              {mastersOpen && (
                <div className="absolute right-0 top-full z-10 mt-2 min-w-36 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                  <a href="/masters?tab=sku" onClick={() => setMastersOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">SKUs</a>
                  <a href="/masters?tab=vendor" onClick={() => setMastersOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">Vendors</a>
                  <a href="/masters?tab=customer" onClick={() => setMastersOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">Customers</a>
                  <a href="/masters?tab=bulk" onClick={() => setMastersOpen(false)}
                    className="block rounded px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 border-t border-gray-100">Bulk Generic Upload</a>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="text-gray-500">{user.name}</span>
              <button onClick={handleLogout} className="text-gray-500 hover:text-gray-800">Log out</button>
            </>
          ) : (
            <>
              <a href="/login" className="text-blue-600 hover:underline">Log in</a>
              <a href="/register" className="text-blue-600 hover:underline">Register</a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
