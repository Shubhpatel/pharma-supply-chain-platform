"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";

const quickActions = [
  { label: "Open inventory", path: "/inventory" },
  { label: "Slow-moving report", path: "/reports?tab=slow-moving" },
  { label: "New purchase order", path: "/purchase/new", action: "form" },
  { label: "New sales invoice", path: "/sales/new", action: "form" },
];

function getAssistantReply(message) {
  const text = message.toLowerCase();
  if (text.includes("inventory") || text.includes("stock")) {
    return { text: "Opening inventory so you can review current stock.", path: "/inventory" };
  }
  if (text.includes("slow") || text.includes("non-moving")) {
    return { text: "Opening the slow-moving inventory report.", path: "/reports?tab=slow-moving" };
  }
  if (text.includes("expired") || text.includes("expiry")) {
    return { text: "Opening the near-expired inventory report.", path: "/reports?tab=near-expired" };
  }
  if (text.includes("sales report") || text.includes("sales analysis")) {
    return { text: "Opening the sales report.", path: "/reports?tab=sales" };
  }
  if (text.includes("purchase order") || text.includes("new po")) {
    return { text: "Opening a new purchase order. Review the form and click Save when ready.", path: "/purchase/new", action: "form" };
  }
  if (text.includes("sales invoice") || text.includes("new sale") || text.includes("invoice")) {
    return { text: "Opening a new sales invoice. Review the form and click Save when ready.", path: "/sales/new", action: "form" };
  }
  if (text.includes("grn") || text.includes("goods receipt")) {
    return { text: "Opening a new GRN. Review the form and click Save when ready.", path: "/grn/new", action: "form" };
  }
  if (text.includes("report")) {
    return { text: "Opening reports. You can choose sales, purchase, expiry, or stock activity.", path: "/reports" };
  }
  return {
    text: "I can open inventory, reports, purchase orders, sales invoices, or GRNs. Try “show slow-moving stock” or “new purchase order”.",
  };
}

export default function PlatformChatbot() {
  const { user, token } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [pendingPurchaseDraft, setPendingPurchaseDraft] = useState(null);
  const [messages, setMessages] = useState([
    { from: "assistant", text: "Hi! I can help you navigate Pharma Buddy and prepare transactions for review." },
  ]);

  if (!user || pathname === "/login" || pathname === "/register") return null;

  function executeAssistantAction(action) {
    if (action?.type === "prepare_purchase_order") {
      sessionStorage.setItem("assistantPurchaseDraft", JSON.stringify(action.items));
      if (action.form) {
        sessionStorage.setItem("assistantPurchaseForm", JSON.stringify(action.form));
      }
      setMessages((current) => [...current, {
        from: "assistant",
        text: `Prepared ${action.items.length} SKU(s) from last month's sales. Select a supplier, review the draft, and click Save Purchase Order.`,
      }]);
      setTimeout(() => router.push("/purchase/new?assistantDraft=last-month-sales"), 350);
    }
  }

  async function prepareDraftFromAssistantReply(reply) {
    const vendorMatch = reply.match(/\*\*Vendor:\*\*\s*([^\n*]+)/i);
    const itemMatch = reply.match(/\*\*Item:\*\*\s*([^\n*]+)/i);
    const qtyMatch = reply.match(/\*\*Requested Qty:\*\*\s*([\d.]+)/i);
    const rateMatch = reply.match(/rate of\s*([\d,.]+)/i);
    const gstMatch = reply.match(/with\s*([\d.]+)%\s*GST/i);
    if (!vendorMatch || !itemMatch || !qtyMatch) return null;

    const [skuData, vendorData] = await Promise.all([
      api.listSkus(true),
      api.listParties("vendor"),
    ]);
    const normalize = (value) => value.trim().toLowerCase().replace(/\s+/g, " ");
    const sku = (skuData.skus || []).find((entry) => normalize(entry.name) === normalize(itemMatch[1]));
    const vendor = (vendorData.parties || []).find((entry) => normalize(entry.name) === normalize(vendorMatch[1]));
    if (!sku || !vendor) return null;

    return {
      type: "prepare_purchase_order",
      form: {
        supplierId: vendor._id,
        supplierName: vendor.name,
      },
      items: [{
        sku: sku._id,
        skuName: sku.name,
        qty: qtyMatch[1],
        rate: rateMatch ? rateMatch[1].replace(/,/g, "") : "",
        gstRate: gstMatch ? gstMatch[1] : "0",
      }],
    };
  }

  function runAction(action) {
    setMessages((current) => [...current, { from: "assistant", text: action.text }]);
    if (action.path) {
      setTimeout(() => router.push(action.path), 250);
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, { from: "user", text: trimmed }]);
    setMessage("");
    if (pendingPurchaseDraft && /open|prefill|pre-filled|review|draft/i.test(trimmed)) {
      executeAssistantAction(pendingPurchaseDraft);
      setPendingPurchaseDraft(null);
      return;
    }
    setChatLoading(true);
    try {
      const result = await api.assistantChat(trimmed, token);
      setMessages((current) => [...current, { from: "assistant", text: result.reply }]);
      if (result.action?.type === "prepare_purchase_order") {
        executeAssistantAction(result.action);
      } else {
        const parsedDraft = await prepareDraftFromAssistantReply(result.reply);
        if (parsedDraft) setPendingPurchaseDraft(parsedDraft);
        if (result.actionPath) {
          setTimeout(() => router.push(result.actionPath), 350);
        }
      }
    } catch (error) {
      const reply = getAssistantReply(trimmed);
      setMessages((current) => [...current, {
        from: "assistant",
        text: `${reply.text} Database assistant error: ${error.message}`,
      }]);
      if (reply.path) setTimeout(() => router.push(reply.path), 350);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 print:hidden">
      {open && (
        <div className="mb-3 flex h-[min(32rem,calc(100vh-7rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-teal-800 px-4 py-3 text-white">
            <div>
              <p className="font-semibold">Pharma Buddy Assistant</p>
              <p className="text-xs text-teal-100">Actions require your review</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="text-xl text-teal-100 hover:text-white">&times;</button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-3">
            {messages.map((item, index) => (
              <div key={`${item.from}-${index}`} className={`flex ${item.from === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${item.from === "user" ? "bg-teal-700 text-white" : "bg-white text-gray-700 shadow-sm"}`}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 bg-white p-3">
            <div className="mb-2 flex flex-wrap gap-1">
              {quickActions.map((action) => (
                <button
                  key={action.path}
                  type="button"
                  onClick={() => runAction({ text: `Opening ${action.label.toLowerCase()}.`, path: action.path })}
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
                placeholder="Ask or give an instruction..."
                aria-label="Assistant message"
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button type="submit" disabled={chatLoading} className="rounded-md bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50">
                {chatLoading ? "..." : "Send"}
              </button>
            </form>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Open platform assistant"
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-800 text-2xl text-white shadow-lg hover:bg-teal-900"
      >
        {open ? "×" : "✦"}
      </button>
    </div>
  );
}
