## 2024-05-18 - Fix Missing Auth & Information Exposure in Inventory Routes
**Vulnerability:** Unauthenticated access to sensitive inventory endpoints (`/api/inventory` and `/api/inventory/history/:skuId`) and exposure of raw error messages to the client.
**Learning:** `requireAuth` was omitted on read-only endpoints, presumably during initial development, and error handlers were dumping `err.message` which could leak stack or DB info.
**Prevention:** Always apply authentication middleware to all non-public API routes, including read-only ones. Catch blocks must log raw errors securely and return sanitized generic messages to clients to prevent CWE-209.
## 2024-10-23 - Sentinel: [MEDIUM] Fix Information Exposure (CWE-209)
**Vulnerability:** Across almost all API routes, internal error messages (`err.message`) from caught exceptions were being sent back to the client directly via `res.status(500).json({ error: err.message })`. This could leak sensitive implementation details, stack traces, or database information.
**Learning:** Returning `err.message` in production API endpoints is a security risk. A previous fix addressed this in `inventory.routes.js`, but this pattern was pervasive throughout the backend. We must systematically apply generic error messages.
**Prevention:** Always log the actual `err.message` to the server console (`console.error`) and return a generic error message (e.g., `"Internal server error"`) to the client for 500 status codes.
