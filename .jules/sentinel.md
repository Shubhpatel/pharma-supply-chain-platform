## 2024-05-18 - Fix Missing Auth & Information Exposure in Inventory Routes
**Vulnerability:** Unauthenticated access to sensitive inventory endpoints (`/api/inventory` and `/api/inventory/history/:skuId`) and exposure of raw error messages to the client.
**Learning:** `requireAuth` was omitted on read-only endpoints, presumably during initial development, and error handlers were dumping `err.message` which could leak stack or DB info.
**Prevention:** Always apply authentication middleware to all non-public API routes, including read-only ones. Catch blocks must log raw errors securely and return sanitized generic messages to clients to prevent CWE-209.
