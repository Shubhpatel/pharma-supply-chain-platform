## 2024-05-18 - Fix Missing Auth & Information Exposure in Inventory Routes
**Vulnerability:** Unauthenticated access to sensitive inventory endpoints (`/api/inventory` and `/api/inventory/history/:skuId`) and exposure of raw error messages to the client.
**Learning:** `requireAuth` was omitted on read-only endpoints, presumably during initial development, and error handlers were dumping `err.message` which could leak stack or DB info.
**Prevention:** Always apply authentication middleware to all non-public API routes, including read-only ones. Catch blocks must log raw errors securely and return sanitized generic messages to clients to prevent CWE-209.

## 2024-10-23 - Predictable Random Number Generation in Draft IDs
**Vulnerability:** Weak random number generator (`Math.random()`) was used to create identifiers for Assistant Drafts.
**Learning:** `Math.random()` is not cryptographically secure and can generate predictable values. In a context where an identifier is used to retrieve, approve, reject, or execute sensitive actions, predictable IDs might lead to ID guessing vulnerabilities (Insecure Direct Object Reference or unauthorized actions if authorization checks fail).
**Prevention:** Always use cryptographically secure methods like `crypto.randomUUID()` or `crypto.randomBytes()` when generating tokens, identifiers, or secrets for sensitive operations.
