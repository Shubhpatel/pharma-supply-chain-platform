"use client";

import { useState } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const { showToast } = useApp();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetToken, setResetToken] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.forgotPassword({ email });
      setSubmitted(true);
      if (res.resetToken) {
        setResetToken(res.resetToken);
      }
      showToast(res.message || "Reset link generated.");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-6">Forgot Password</h1>
      {submitted ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            If an account with that email exists, password reset instructions have been generated.
          </p>
          {resetToken && (
            <div className="p-3 bg-gray-100 rounded-md text-xs break-all">
              <strong>Dev Token:</strong> {resetToken}
            </div>
          )}
          <div>
            <Link
              href={resetToken ? `/reset-password?token=${resetToken}` : "/reset-password"}
              className="inline-block py-2 px-4 rounded-md bg-gray-900 text-white text-sm font-medium"
            >
              Go to Reset Password Page
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email address</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="user@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Sending..." : "Request Reset Token"}
          </button>
          <div className="text-center mt-2">
            <Link href="/login" className="text-xs text-blue-600 hover:underline">
              Back to Login
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
