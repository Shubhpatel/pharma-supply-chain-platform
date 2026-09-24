"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";

export default function NavBar() {
  const { user, logout, showToast } = useApp();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);

  function handleLogout() {
    logout();
    showToast("Logged out successfully.");
  }

  return (
    <nav className="border-b border-gray-200 bg-white/95 backdrop-blur print:hidden">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
        <a href="/" className="font-semibold text-lg tracking-tight text-teal-800">Pharma Buddy</a>
        {user && (
          <div className="flex items-center gap-1 text-sm">
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
                  <a href="/purchase/returns" onClick={() => setPurchaseOpen(false)}
                    className="block rounded px-3 py-2 text-sm text-gray-600 hover:bg-teal-50 hover:text-teal-800">Purchase Returns (Debit Note)</a>
                </div>
              )}
            </div>

            <a href="/grn" className="rounded-md px-3 py-2 text-gray-600 hover:bg-teal-50 hover:text-teal-800">GRN</a>
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
              <button type="button" onClick={() => { setMastersOpen((open) => !open); setPurchaseOpen(false); setSalesOpen(false); }}
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
