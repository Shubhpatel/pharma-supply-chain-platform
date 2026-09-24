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
};
