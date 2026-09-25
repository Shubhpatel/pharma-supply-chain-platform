const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function apiFetch(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  register: (payload) => apiFetch("/auth/register", { method: "POST", body: payload }),
  login: (payload) => apiFetch("/auth/login", { method: "POST", body: payload }),

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

  // GRN
  listGrns: () => apiFetch("/grn"),
  getGrn: (id) => apiFetch(`/grn/${id}`),
  createGrn: (payload, token) => apiFetch("/grn", { method: "POST", body: payload, token }),

  // Inventory
  listStock: () => apiFetch("/inventory"),

  // Sales
  listInvoices: () => apiFetch("/sales"),
  getInvoice: (id) => apiFetch(`/sales/${id}`),
  createInvoice: (payload, token) => apiFetch("/sales", { method: "POST", body: payload, token }),

  // Purchase Returns (Debit Notes)
  listDebitNotes: () => apiFetch("/debit-notes"),
  getDebitNote: (id) => apiFetch(`/debit-notes/${id}`),
  createDebitNote: (payload, token) => apiFetch("/debit-notes", { method: "POST", body: payload, token }),

  // Sales Returns (Credit Notes)
  listCreditNotes: () => apiFetch("/credit-notes"),
  getCreditNote: (id) => apiFetch(`/credit-notes/${id}`),
  createCreditNote: (payload, token) => apiFetch("/credit-notes", { method: "POST", body: payload, token }),
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
};
