"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

const quickActions = [
  { label: "Open inventory", path: "/inventory" },
  { label: "Slow-moving report", path: "/reports?tab=slow-moving" },
  { label: "New purchase order", path: "/purchase/new" },
  { label: "New sales invoice", path: "/sales/new" },
];

function getAssistantFallbackReply(message) {
  const text = message.toLowerCase();
  if (text.includes("inventory") || text.includes("stock")) {
    return { text: "Opening inventory page for stock review.", path: "/inventory" };
  }
  if (text.includes("slow")) {
    return { text: "Opening the slow-moving inventory report.", path: "/reports?tab=slow-moving" };
  }
  if (text.includes("expired") || text.includes("expiry")) {
    return { text: "Opening the near-expired inventory report.", path: "/reports?tab=near-expired" };
  }
  if (text.includes("purchase order") || text.includes("new po")) {
    return { text: "Opening new purchase order form.", path: "/purchase/new" };
  }
  if (text.includes("sales invoice") || text.includes("new sale") || text.includes("invoice")) {
    return { text: "Opening new sales invoice form.", path: "/sales/new" };
  }
  return {
    text: "I can answer database questions, analyze inventory & sales, or prepare structured transaction drafts for review.",
  };
}

export default function PlatformChatbot() {
  const { user, token } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionStatusMessage, setActionStatusMessage] = useState(null);
  const [messages, setMessages] = useState([
    {
      from: "assistant",
      text: "Hi! I am Pharma Buddy. Ask me about stock levels, expiry, or ask me to prepare a transaction draft.",
      source: "Database analysis",
    },
  ]);

  if (!user || pathname === "/login" || pathname === "/register") return null;

  async function handleApproveDraft() {
    if (!pendingDraft?.draftId) return;
    setActionLoading(true);
    setActionStatusMessage(null);
    try {
      const res = await api.approveAssistantDraft(pendingDraft.draftId, token);
      setPendingDraft(res.draft);
      setActionStatusMessage({ type: "success", text: "Draft approved! Click 'Execute Approved Action' to execute." });
      setMessages((current) => [
        ...current,
        {
          from: "assistant",
          text: `Draft "${res.draft.summary}" has been approved. Explicit user approval recorded.`,
          source: "Database analysis",
        },
      ]);
    } catch (err) {
      setActionStatusMessage({ type: "error", text: err.message || "Failed to approve draft." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectDraft() {
    if (!pendingDraft?.draftId) return;
    setActionLoading(true);
    setActionStatusMessage(null);
    try {
      const res = await api.rejectAssistantDraft(pendingDraft.draftId, token);
      setPendingDraft(null);
      setActionStatusMessage({ type: "info", text: "Draft rejected." });
      setMessages((current) => [
        ...current,
        {
          from: "assistant",
          text: `Draft rejected. No changes were made to the database.`,
          source: "Database analysis",
        },
      ]);
    } catch (err) {
      setActionStatusMessage({ type: "error", text: err.message || "Failed to reject draft." });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExecuteDraft() {
    if (!pendingDraft?.draftId) return;
    setActionLoading(true);
    setActionStatusMessage(null);
    try {
      const res = await api.executeAssistantDraft(pendingDraft.draftId, token);
      setPendingDraft(null);
      const recordRef = res.resultRecord?.poNumber || res.resultRecord?.invoiceNumber || res.resultRecord?._id || "record";
      setActionStatusMessage({ type: "success", text: `Successfully executed! Created ${recordRef}.` });
      setMessages((current) => [
        ...current,
        {
          from: "assistant",
          text: `Action executed successfully! Created ${recordRef}. Status in database is updated.`,
          source: "Database analysis",
        },
      ]);
    } catch (err) {
      setActionStatusMessage({ type: "error", text: err.message || "Execution failed." });
    } finally {
      setActionLoading(false);
    }
  }

  function handleReviewDraft() {
    if (pendingDraft?.actionType === "create_purchase_order") {
      sessionStorage.setItem("assistantPurchaseDraft", JSON.stringify(pendingDraft.proposedPayload?.items || []));
      router.push("/purchase/new?assistantDraft=true");
    } else if (pendingDraft?.actionType === "create_sales_invoice") {
      sessionStorage.setItem("assistantSalesDraft", JSON.stringify(pendingDraft.proposedPayload?.items || []));
      router.push("/sales/new?assistantDraft=true");
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    setMessages((current) => [...current, { from: "user", text: trimmed }]);
    setMessage("");
    setActionStatusMessage(null);
    setChatLoading(true);

    try {
      const result = await api.assistantChat(trimmed, token);
      setMessages((current) => [
        ...current,
        {
          from: "assistant",
          text: result.reply,
          source: result.source === "gemini" ? "AI analysis" : "Database analysis",
        },
      ]);

      if (result.actionDraft) {
        setPendingDraft(result.actionDraft);
      }

      if (result.navigation?.path) {
        setTimeout(() => router.push(result.navigation.path), 350);
      }
    } catch (error) {
      const fallback = getAssistantFallbackReply(trimmed);
      setMessages((current) => [
        ...current,
        {
          from: "assistant",
          text: `${fallback.text} (Note: ${error.message})`,
          source: "Fallback",
        },
      ]);
      if (fallback.path) setTimeout(() => router.push(fallback.path), 350);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 print:hidden">
      {open && (
        <div className="mb-3 flex h-[min(36rem,calc(100vh-7rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-teal-800 px-4 py-3 text-white">
            <div>
              <p className="font-semibold">Pharma Buddy AI Assistant</p>
              <p className="text-xs text-teal-100">Read-only by default • Drafts require approval</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="text-xl text-teal-100 hover:text-white"
            >
              &times;
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-3">
            {messages.map((item, index) => (
              <div
                key={`${item.from}-${index}`}
                className={`flex flex-col ${item.from === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                    item.from === "user" ? "bg-teal-700 text-white" : "bg-white text-gray-700 shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{item.text}</p>
                </div>
                {item.source && item.from === "assistant" && (
                  <span className="mt-0.5 text-[10px] text-gray-400">{item.source}</span>
                )}
              </div>
            ))}

            {/* Action Status Feedback Message */}
            {actionStatusMessage && (
              <div
                className={`rounded-md p-2 text-xs font-medium ${
                  actionStatusMessage.type === "success"
                    ? "bg-green-50 text-green-800 border border-green-200"
                    : actionStatusMessage.type === "error"
                    ? "bg-red-50 text-red-800 border border-red-200"
                    : "bg-blue-50 text-blue-800 border border-blue-200"
                }`}
              >
                {actionStatusMessage.text}
              </div>
            )}

            {/* Render Structured Action Draft Confirmation Card */}
            {pendingDraft && (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 shadow-md">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                    Action Draft (Requires Approval)
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      pendingDraft.status === "approved"
                        ? "bg-green-200 text-green-800"
                        : "bg-amber-200 text-amber-800"
                    }`}
                  >
                    {pendingDraft.status}
                  </span>
                </div>

                <div className="mt-2 space-y-1.5 text-xs text-gray-800">
                  <p>
                    <strong className="font-semibold text-gray-900">Summary:</strong> {pendingDraft.summary}
                  </p>
                  <p>
                    <strong className="font-semibold text-gray-900">Reason:</strong> {pendingDraft.reason || "N/A"}
                  </p>

                  {/* Vendor or Customer */}
                  {pendingDraft.proposedPayload?.supplierName && (
                    <p>
                      <strong className="font-semibold text-gray-900">Vendor:</strong>{" "}
                      {pendingDraft.proposedPayload.supplierName}
                    </p>
                  )}
                  {pendingDraft.proposedPayload?.customerName && (
                    <p>
                      <strong className="font-semibold text-gray-900">Customer:</strong>{" "}
                      {pendingDraft.proposedPayload.customerName}
                    </p>
                  )}

                  {/* Items Table / Summary */}
                  {Array.isArray(pendingDraft.proposedPayload?.items) && (
                    <div className="mt-1.5">
                      <strong className="font-semibold text-gray-900">Line Items:</strong>
                      <ul className="mt-1 max-h-24 space-y-1 overflow-y-auto rounded bg-white p-1.5 border border-amber-200">
                        {pendingDraft.proposedPayload.items.map((item, idx) => (
                          <li key={idx} className="flex justify-between text-[11px]">
                            <span>{item.skuName || `SKU #${item.sku}`}</span>
                            <span className="font-mono">
                              {item.qty} qty @ ₹{item.rate || item.mrp || 0}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings */}
                  {pendingDraft.warnings?.length > 0 && (
                    <div className="mt-1 text-red-700">
                      <strong>Warnings:</strong> {pendingDraft.warnings.join(", ")}
                    </div>
                  )}

                  {/* Estimated Impact */}
                  {pendingDraft.estimatedImpact && (
                    <p className="mt-1 text-gray-600">
                      <strong>Impact:</strong> {pendingDraft.estimatedImpact}
                    </p>
                  )}
                </div>

                {/* Explicit Action Buttons */}
                <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-amber-200">
                  <button
                    type="button"
                    onClick={handleReviewDraft}
                    disabled={actionLoading}
                    className="rounded bg-white px-2.5 py-1 text-xs font-medium text-amber-900 border border-amber-300 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Review form
                  </button>

                  {pendingDraft.status === "pending" && (
                    <button
                      type="button"
                      onClick={handleApproveDraft}
                      disabled={actionLoading}
                      className="rounded bg-teal-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-900 disabled:opacity-50"
                    >
                      {actionLoading ? "..." : "Approve draft"}
                    </button>
                  )}

                  {pendingDraft.status === "approved" && (
                    <button
                      type="button"
                      onClick={handleExecuteDraft}
                      disabled={actionLoading}
                      className="rounded bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {actionLoading ? "Executing..." : "Execute action"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleRejectDraft}
                    disabled={actionLoading}
                    className="rounded bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 hover:bg-red-200 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions & Input Form */}
          <div className="border-t border-gray-200 bg-white p-3">
            <div className="mb-2 flex flex-wrap gap-1">
              {quickActions.map((action) => (
                <button
                  key={action.path}
                  type="button"
                  onClick={() => {
                    setMessages((curr) => [
                      ...curr,
                      { from: "assistant", text: `Navigating to ${action.label}.`, source: "Navigation" },
                    ]);
                    router.push(action.path);
                  }}
                  className="rounded-full border border-teal-200 px-2 py-1 text-xs text-teal-800 hover:bg-teal-50"
                >
                  {action.label}
                </button>
              ))}
            </div>

            <form onSubmit={submitMessage} className="flex gap-2">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ask stock questions or request drafts..."
                aria-label="Assistant message"
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={chatLoading || actionLoading}
                className="rounded-md bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50"
              >
                {chatLoading ? "..." : "Send"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Open platform assistant"
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-800 text-2xl text-white shadow-lg hover:bg-teal-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
      >
        {open ? "×" : "✦"}
      </button>
    </div>
  );
}
