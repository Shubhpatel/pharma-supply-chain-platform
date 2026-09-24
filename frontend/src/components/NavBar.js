"use client";

import { useApp } from "@/context/AppContext";

export default function NavBar() {
  const { user, logout, showToast } = useApp();

  function handleLogout() {
    logout();
    showToast("Logged out successfully.");
  }

  return (
    <nav className="border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
        <a href="/" className="font-semibold text-lg tracking-tight text-teal-800">Pharma Buddy</a>
        {user && (
          <div className="flex items-center gap-1 text-sm">
            <a href="/purchase" className="rounded-md px-3 py-2 text-gray-600 hover:bg-teal-50 hover:text-teal-800">Purchase</a>
            <a href="/grn" className="rounded-md px-3 py-2 text-gray-600 hover:bg-teal-50 hover:text-teal-800">GRN</a>
            <a href="/inventory" className="rounded-md px-3 py-2 text-gray-600 hover:bg-teal-50 hover:text-teal-800">Inventory</a>
            <a href="/sales" className="rounded-md px-3 py-2 text-gray-600 hover:bg-teal-50 hover:text-teal-800">Sales</a>
            <a href="/masters" className="rounded-md px-3 py-2 text-gray-600 hover:bg-teal-50 hover:text-teal-800">Masters</a>
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
