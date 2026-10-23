"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useApp();

  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tokenFromQuery = searchParams.get("token");
    if (tokenFromQuery) {
      setToken(tokenFromQuery);
    }
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 4) {
      setError("Password must be at least 4 characters long");
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetPassword({ token, newPassword });
      showToast(res.message || "Password reset successful.");
      router.push("/login");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Reset Token</label>
        <input
          required
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          placeholder="Paste your reset token"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">New Password</label>
        <input
          required
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Confirm New Password</label>
        <input
          required
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 rounded-md bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Resetting..." : "Reset Password"}
      </button>
      <div className="text-center mt-2">
        <Link href="/login" className="text-xs text-blue-600 hover:underline">
          Back to Login
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-6">Reset Password</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
