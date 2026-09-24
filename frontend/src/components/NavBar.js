"use client";

import { useApp } from "@/context/AppContext";

export default function NavBar() {
  const { user, logout, showToast } = useApp();

  function handleLogout() {
    logout();
    showToast("Logged out successfully.");
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <a href="/" className="font-semibold text-lg">Pharma Buddy</a>
        {user && (
          <div className="flex items-center gap-4 text-sm">
            <a href="/purchase" className="text-gray-700 hover:text-blue-600">Purchase</a>
            <a href="/grn" className="text-gray-700 hover:text-blue-600">GRN</a>
            <a href="/inventory" className="text-gray-700 hover:text-blue-600">Inventory</a>
            <a href="/sales" className="text-gray-700 hover:text-blue-600">Sales</a>
            <a href="/masters" className="text-gray-700 hover:text-blue-600">Masters</a>
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
