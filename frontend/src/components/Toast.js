"use client";

import { useEffect } from "react";
import { useApp } from "@/context/AppContext";

export default function Toast() {
  const { toast, hideToast } = useApp();

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(hideToast, 4000);
    return () => window.clearTimeout(timeout);
  }, [toast, hideToast]);

  if (!toast) return null;

  const isError = toast.type === "error";

  return (
    <div className="fixed right-4 top-4 z-50 w-[min(24rem,calc(100vw-2rem))]" role="status" aria-live="polite">
      <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
        isError ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"
      }`}>
        <p className="flex-1">{toast.message}</p>
        <button type="button" onClick={hideToast} className="font-semibold opacity-70 hover:opacity-100" aria-label="Dismiss notification">
          x
        </button>
      </div>
    </div>
  );
}