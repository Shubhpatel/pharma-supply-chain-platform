const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function apiFetch(path, { method = "GET", body, token, timeoutMs = 15000 } = {}) {
  const storedToken = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const authToken = token || storedToken;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  login: (payload) => apiFetch("/auth/login", { method: "POST", body: payload }),
  forgotPassword: (payload) => apiFetch("/auth/forgot-password", { method: "POST", body: payload }),
  resetPassword: (payload) => apiFetch("/auth/reset-password", { method: "POST", body: payload }),

  // User Management
  listUsers: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/users${query ? `?${query}` : ""}`, { token });
  },
  createUser: (payload, token) => apiFetch("/users", { method: "POST", body: payload, token }),
  updateUser: (id, payload, token) => apiFetch(`/users/${id}`, { method: "PUT", body: payload, token }),
  deleteUser: (id, token) => apiFetch(`/users/${id}`, { method: "DELETE", token }),

  // Masters / SKUs
  listSkus: (enabledOnly, token, params = {}) => {
    const query = new URLSearchParams({ ...(enabledOnly ? { enabled: "true" } : {}), ...params }).toString();
    return apiFetch(`/skus${query ? `?${query}` : ""}`, { token });
  },
  searchSkus: (search, enabledOnly, token) => api.listSkus(enabledOnly, token, { search, limit: 20 }),
  createSku: (payload, token) => apiFetch("/skus", { method: "POST", body: payload, token }),
  updateSku: (id, payload, token) => apiFetch(`/skus/${id}`, { method: "PUT", body: payload, token }),
  toggleSku: (id, token) => apiFetch(`/skus/${id}/toggle`, { method: "PATCH", token }),
  deleteSku: (id, token) => apiFetch(`/skus/${id}`, { method: "DELETE", token }),
  downloadSkus: async (format, token) => {
    const res = await fetch(`${API_URL}/skus/export?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `skus.${format === "xlsx" ? "xlsx" : "csv"}`;
    link.click();
    URL.revokeObjectURL(url);
  },

  // SKU locations
  listSkuLocations: (enabledOnly, params = {}) => {
    const query = new URLSearchParams({ ...(enabledOnly ? { enabled: "true" } : {}), ...params }).toString();
    return apiFetch(`/sku-locations${query ? `?${query}` : ""}`);
  },
  createSkuLocation: (payload, token) => apiFetch("/sku-locations", { method: "POST", body: payload, token }),
  updateSkuLocation: (id, payload, token) => apiFetch(`/sku-locations/${id}`, { method: "PUT", body: payload, token }),
  deleteSkuLocation: (id, token) => apiFetch(`/sku-locations/${id}`, { method: "DELETE", token }),
  downloadSkuLocations: async (format, token) => {
    const res = await fetch(`${API_URL}/sku-locations/export?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sku_locations.${format === "xlsx" ? "xlsx" : "csv"}`;
    link.click();
    URL.revokeObjectURL(url);
  },

  // Vendors and customers
  listParties: (type, token, params = {}) => {
    const query = new URLSearchParams({ type, ...params }).toString();
    return apiFetch(`/parties?${query}`, { token });
  },
  searchParties: (type, search, token) => api.listParties(type, token, { search, limit: 20 }),
  createParty: (payload, token) => apiFetch("/parties", { method: "POST", body: payload, token }),
  updateParty: (id, payload, token) => apiFetch(`/parties/${id}`, { method: "PUT", body: payload, token }),
  deleteParty: (id, token) => apiFetch(`/parties/${id}`, { method: "DELETE", token }),

  // Purchase orders
  listPurchaseOrders: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/purchase-orders${query ? `?${query}` : ""}`, { token });
  },
  listOpenPurchaseOrders: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/purchase-orders/open/list${query ? `?${query}` : ""}`, { token });
  },
  getPurchaseOrder: (id, token) => apiFetch(`/purchase-orders/${id}`, { token }),
  createPurchaseOrder: (payload, token) => apiFetch("/purchase-orders", { method: "POST", body: payload, token }),
  updatePurchaseOrder: (id, payload, token) => apiFetch(`/purchase-orders/${id}`, { method: "PUT", body: payload, token }),
  deletePurchaseOrder: (id, token) => apiFetch(`/purchase-orders/${id}`, { method: "DELETE", token }),
  duplicatePurchaseOrder: (id, token) => apiFetch(`/purchase-orders/${id}/duplicate`, { method: "POST", token }),
  uploadBulkPurchaseOrders: async (formData, token) => {
    const res = await fetch(`${API_URL}/purchase-orders/bulk-upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || `Upload failed: ${res.status}`);
      error.bulkUploadId = data.bulkUploadId;
      throw error;
    }
    return data;
  },
  downloadPurchaseOrderSample: (format = "csv") => {
    window.open(`${API_URL}/purchase-orders/bulk-sample?format=${format}`, "_blank");
  },
  confirmPurchaseOrder: (id, token) => apiFetch(`/purchase-orders/${id}/confirm`, { method: "PATCH", token }),

  // GRN
  listGrns: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/grn${query ? `?${query}` : ""}`, { token });
  },
  getGrn: (id, token) => apiFetch(`/grn/${id}`, { token }),
  createGrn: (payload, token) => apiFetch("/grn", { method: "POST", body: payload, token }),
  updateGrn: (id, payload, token) => apiFetch(`/grn/${id}`, { method: "PUT", body: payload, token }),
  deleteGrn: (id, token) => apiFetch(`/grn/${id}`, { method: "DELETE", token }),
  confirmGrn: (id, token) => apiFetch(`/grn/${id}/confirm`, { method: "PATCH", token }),

  // Inventory
  listStock: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/inventory${query ? `?${query}` : ""}`, { token });
  },
  getInventoryHistory: (skuId, params = {}, token) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/inventory/history/${skuId}${q ? `?${q}` : ""}`, { token });
  },

  // Sales
  listInvoices: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/sales${query ? `?${query}` : ""}`, { token });
  },
  getInvoice: (id, token) => apiFetch(`/sales/${id}`, { token }),
  createInvoice: (payload, token) => apiFetch("/sales", { method: "POST", body: payload, token }),
  updateInvoice: (id, payload, token) => apiFetch(`/sales/${id}`, { method: "PUT", body: payload, token }),
  deleteInvoice: (id, token) => apiFetch(`/sales/${id}`, { method: "DELETE", token }),
  duplicateInvoice: (id, token) => apiFetch(`/sales/${id}/duplicate`, { method: "POST", token }),
  confirmInvoice: (id, token) => apiFetch(`/sales/${id}/confirm`, { method: "PATCH", token }),

  // Purchase Returns (Debit Notes)
  listDebitNotes: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/debit-notes${query ? `?${query}` : ""}`, { token });
  },
  getDebitNote: (id, token) => apiFetch(`/debit-notes/${id}`, { token }),
  createDebitNote: (payload, token) => apiFetch("/debit-notes", { method: "POST", body: payload, token }),
  updateDebitNote: (id, payload, token) => apiFetch(`/debit-notes/${id}`, { method: "PUT", body: payload, token }),
  deleteDebitNote: (id, token) => apiFetch(`/debit-notes/${id}`, { method: "DELETE", token }),
  confirmDebitNote: (id, token) => apiFetch(`/debit-notes/${id}/confirm`, { method: "PATCH", token }),

  // Sales Returns (Credit Notes)
  listCreditNotes: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiFetch(`/credit-notes${query ? `?${query}` : ""}`, { token });
  },
  getCreditNote: (id, token) => apiFetch(`/credit-notes/${id}`, { token }),
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
