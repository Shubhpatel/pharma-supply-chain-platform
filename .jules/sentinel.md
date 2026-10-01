## 2025-02-23 - Information Exposure (CWE-209) in Route Handlers
**Vulnerability:** Across many route handlers in the backend (e.g., `auth.routes.js`, `purchaseOrder.routes.js`, etc.), the catch block directly exposes `err.message` in 500 responses (`res.status(500).json({ error: err.message });`).
**Learning:** Returning unhandled exception messages directly to the client can leak sensitive infrastructure details, database connection strings, query structures, or internal library errors. This was likely a shortcut taken during rapid development.
**Prevention:** Always catch and log raw errors securely on the server using `console.error` (or a dedicated logger), and return a sanitized, generic error message (e.g., `"Internal server error"`) to the client.
