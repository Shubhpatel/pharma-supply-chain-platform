"use client";

import { useApp } from "@/context/AppContext";

const MODULES = [
  { href: "/purchase", title: "Purchase", desc: "Create and track purchase orders to suppliers." },
  { href: "/grn", title: "GRN", desc: "Record goods received against a purchase order." },
  { href: "/inventory", title: "Inventory", desc: "Current stock on hand across all SKUs." },
  { href: "/sales", title: "Sales", desc: "Create invoices and sell from stock." },
  { href: "/masters", title: "Masters (SKUs)", desc: "Add/remove SKUs - only enabled ones show up in dropdowns." },
];

export default function Home() {
  const { user } = useApp();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Pharma Inventory Management</h1>
      <p className="text-gray-600 max-w-2xl">
        Purchase → GRN → Inventory → Sales, with a Masters module to manage which products are available.
      </p>

      {!user ? (
        <div className="flex gap-3">
          <a href="/register" className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium">Get started</a>
          <a href="/login" className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium">Log in</a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {MODULES.map((m) => (
            <a key={m.href} href={m.href} className="border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-400">
              <div className="font-medium">{m.title}</div>
              <div className="text-xs text-gray-500 mt-1">{m.desc}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
