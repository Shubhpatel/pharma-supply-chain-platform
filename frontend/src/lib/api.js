const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function apiFetch(path, { method = "GET", body, token, timeoutMs = 45000 } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  register: (payload) => apiFetch("/auth/register", { method: "POST", body: payload }),
  login: (payload) => apiFetch("/auth/login", { method: "POST", body: payload }),
  forgotPassword: (payload) => apiFetch("/auth/forgot-password", { method: "POST", body: payload }),
  resetPassword: (payload) => apiFetch("/auth/reset-password", { method: "POST", body: payload }),

  // Masters / SKUs
  listSkus: (enabledOnly) => apiFetch(`/skus${enabledOnly ? "?enabled=true" : ""}`),
  createSku: (payload, token) => apiFetch("/skus", { method: "POST", body: payload, token }),
  updateSku: (id, payload, token) => apiFetch(`/skus/${id}`, { method: "PUT", body: payload, token }),
  toggleSku: (id, token) => apiFetch(`/skus/${id}/toggle`, { method: "PATCH", token }),
  deleteSku: (id, token) => apiFetch(`/skus/${id}`, { method: "DELETE", token }),

  // Vendors and customers
  listParties: (type) => apiFetch(`/parties?type=${type}`),
  createParty: (payload, token) => apiFetch("/parties", { method: "POST", body: payload, token }),
  updateParty: (id, payload, token) => apiFetch(`/parties/${id}`, { method: "PUT", body: payload, token }),
  deleteParty: (id, token) => apiFetch(`/parties/${id}`, { method: "DELETE", token }),

  // Purchase orders
  listPurchaseOrders: () => apiFetch("/purchase-orders"),
  listOpenPurchaseOrders: () => apiFetch("/purchase-orders/open/list"),
  getPurchaseOrder: (id) => apiFetch(`/purchase-orders/${id}`),
  createPurchaseOrder: (payload, token) => apiFetch("/purchase-orders", { method: "POST", body: payload, token }),
  updatePurchaseOrder: (id, payload, token) => apiFetch(`/purchase-orders/${id}`, { method: "PUT", body: payload, token }),
  deletePurchaseOrder: (id, token) => apiFetch(`/purchase-orders/${id}`, { method: "DELETE", token }),
  duplicatePurchaseOrder: (id, token) => apiFetch(`/purchase-orders/${id}/duplicate`, { method: "POST", token }),
  confirmPurchaseOrder: (id, token) => apiFetch(`/purchase-orders/${id}/confirm`, { method: "PATCH", token }),

  // GRN
  listGrns: () => apiFetch("/grn"),
  getGrn: (id) => apiFetch(`/grn/${id}`),
  createGrn: (payload, token) => apiFetch("/grn", { method: "POST", body: payload, token }),
  updateGrn: (id, payload, token) => apiFetch(`/grn/${id}`, { method: "PUT", body: payload, token }),
  deleteGrn: (id, token) => apiFetch(`/grn/${id}`, { method: "DELETE", token }),
  confirmGrn: (id, token) => apiFetch(`/grn/${id}/confirm`, { method: "PATCH", token }),

  // Inventory
  listStock: (token) => apiFetch("/inventory", { token }),
  getInventoryHistory: (skuId, params = {}, token) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/inventory/history/${skuId}${q ? `?${q}` : ""}`, { token });
  },

  // Sales
  listInvoices: (token) => apiFetch("/sales", { token }),
  getInvoice: (id) => apiFetch(`/sales/${id}`),
  createInvoice: (payload, token) => apiFetch("/sales", { method: "POST", body: payload, token }),
  updateInvoice: (id, payload, token) => apiFetch(`/sales/${id}`, { method: "PUT", body: payload, token }),
  deleteInvoice: (id, token) => apiFetch(`/sales/${id}`, { method: "DELETE", token }),
  duplicateInvoice: (id, token) => apiFetch(`/sales/${id}/duplicate`, { method: "POST", token }),
  confirmInvoice: (id, token) => apiFetch(`/sales/${id}/confirm`, { method: "PATCH", token }),

  // Purchase Returns (Debit Notes)
  listDebitNotes: () => apiFetch("/debit-notes"),
  getDebitNote: (id) => apiFetch(`/debit-notes/${id}`),
  createDebitNote: (payload, token) => apiFetch("/debit-notes", { method: "POST", body: payload, token }),
  updateDebitNote: (id, payload, token) => apiFetch(`/debit-notes/${id}`, { method: "PUT", body: payload, token }),
  deleteDebitNote: (id, token) => apiFetch(`/debit-notes/${id}`, { method: "DELETE", token }),
  confirmDebitNote: (id, token) => apiFetch(`/debit-notes/${id}/confirm`, { method: "PATCH", token }),

  // Sales Returns (Credit Notes)
  listCreditNotes: () => apiFetch("/credit-notes"),
  getCreditNote: (id) => apiFetch(`/credit-notes/${id}`),
  createCreditNote: (payload, token) => apiFetch("/credit-notes", { method: "POST", body: payload, token }),
  updateCreditNote: (id, payload, token) => apiFetch(`/credit-notes/${id}`, { method: "PUT", body: payload, token }),
  deleteCreditNote: (id, token) => apiFetch(`/credit-notes/${id}`, { method: "DELETE", token }),
  confirmCreditNote: (id, token) => apiFetch(`/credit-notes/${id}/confirm`, { method: "PATCH", token }),

  // Reports
  getSalesReport: (params, token) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/reports/sales${q ? `?${q}` : ""}`, { token });
  },
  getGrnReport: (params, token) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/reports/grn${q ? `?${q}` : ""}`, { token });
  },
  getPoReport: (params, token) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/reports/po${q ? `?${q}` : ""}`, { token });
  },
  getNearExpiredReport: (days, token) => apiFetch(`/reports/near-expired?days=${days || 30}`, { token }),
  getExpiredReport: (token) => apiFetch("/reports/expired", { token }),
  getSlowMovingReport: (token) => apiFetch("/reports/slow-moving", { token }),
  getNonMovingReport: (token) => apiFetch("/reports/non-moving", { token }),
  generateAiReport: (payload, token) => apiFetch("/reports/ai-summary", {
    method: "POST",
    body: payload,
    token,
    timeoutMs: 15000,
  }),

  // Assistant & Draft Operations
  getAssistantHistory: (token) => apiFetch("/assistant/history", { token }),
  saveAssistantMessage: (payload, token) => apiFetch("/assistant/history", {
    method: "POST",
    body: payload,
    token,
  }),
  assistantChat: (message, token) => apiFetch("/assistant/chat", {
    method: "POST",
    body: { message },
    token,
    timeoutMs: 15000,
  }),
  createAssistantDraft: (payload, token) => apiFetch("/assistant/drafts", {
    method: "POST",
    body: payload,
    token,
  }),
  listAssistantDrafts: (token) => apiFetch("/assistant/drafts", { token }),
  getAssistantDraft: (draftId, token) => apiFetch(`/assistant/drafts/${draftId}`, { token }),
  approveAssistantDraft: (draftId, token) => apiFetch(`/assistant/drafts/${draftId}/approve`, {
    method: "POST",
    token,
  }),
  rejectAssistantDraft: (draftId, token) => apiFetch(`/assistant/drafts/${draftId}/reject`, {
    method: "POST",
    token,
  }),
  executeAssistantDraft: (draftId, token) => apiFetch(`/assistant/drafts/${draftId}/execute`, {
    method: "POST",
    token,
  }),

  // Bulk Uploads
  listBulkUploads: (token) => apiFetch("/bulk-uploads", { token }),
  uploadBulkMaster: async (formData, token) => {
    const res = await fetch(`${API_URL}/bulk-uploads`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Upload failed: ${res.status}`);
      err.bulkUploadId = data.bulkUploadId;
      throw err;
    }
    return data;
  },
  downloadSampleFile: (masterType, format = "csv") => {
    window.open(`${API_URL}/bulk-uploads/sample?masterType=${masterType}&format=${format}`, "_blank");
  },
  downloadErrorFile: (uploadId, format = "csv", token) => {
    const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";
    window.open(`${API_URL}/bulk-uploads/${uploadId}/error-file?format=${format}${tokenQuery}`, "_blank");
  },
};
