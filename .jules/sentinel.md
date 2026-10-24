## 2026-10-23 - [Information Disclosure & Weak RNG] 
**Vulnerability:** Unhandled 500 errors were leaking raw backend stack traces or internal message details (`err.message`) to clients. Additionally, Draft IDs were generated using predictable `Math.random()`. **Learning:** A centralized error handling architecture was missing and insecure predictable random number generation was used for sensitive identifiers. **Prevention:** Always use a global error handling middleware in Express to mask internal error details and use `crypto.randomBytes` or `crypto.randomUUID` for sensitive identifier generation.

## 2024-05-23 - AI Assistant RBAC Bypass
**Vulnerability:** The AI Assistant draft execution endpoint lacked RBAC (Role-Based Access Control) checks on the underlying actions it performed. This allowed any user with access to the assistant to execute restricted actions (like creating purchase orders or toggling SKUs) by using the AI Assistant as a proxy, bypassing standard endpoint permissions.
**Learning:** API routes backing AI Assistants must manually enforce RBAC because the Assistant acts as a proxy executing actions on the user's behalf. Permissions on standard endpoints do not automatically apply to the assistant's execution engine.
**Prevention:** Always perform explicit permission checks within the execution logic of an AI assistant, mapped to the specific `actionType` or operation being performed, just as you would on a standard API endpoint.

## 2024-05-18 - Fix Missing Auth & Information Exposure in Inventory Routes
**Vulnerability:** Unauthenticated access to sensitive inventory endpoints (`/api/inventory` and `/api/inventory/history/:skuId`) and exposure of raw error messages to the client.
**Learning:** `requireAuth` was omitted on read-only endpoints, presumably during initial development, and error handlers were dumping `err.message` which could leak stack or DB info.
**Prevention:** Always apply authentication middleware to all non-public API routes, including read-only ones. Catch blocks must log raw errors securely and return sanitized generic messages to clients to prevent CWE-209.

## 2024-10-23 - Sentinel: [MEDIUM] Fix Information Exposure (CWE-209)
**Vulnerability:** Across almost all API routes, internal error messages (`err.message`) from caught exceptions were being sent back to the client directly via `res.status(500).json({ error: err.message })`. This could leak sensitive implementation details, stack traces, or database information.
**Learning:** Returning `err.message` in production API endpoints is a security risk. A previous fix addressed this in `inventory.routes.js`, but this pattern was pervasive throughout the backend. We must systematically apply generic error messages.
**Prevention:** Always log the actual `err.message` to the server console (`console.error`) and return a generic error message (e.g., `"Internal server error"`) to the client for 500 status codes.

## 2024-10-23 - Predictable Random Number Generation in Draft IDs
**Vulnerability:** Weak random number generator (`Math.random()`) was used to create identifiers for Assistant Drafts.
**Learning:** `Math.random()` is not cryptographically secure and can generate predictable values. In a context where an identifier is used to retrieve, approve, reject, or execute sensitive actions, predictable IDs might lead to ID guessing vulnerabilities (Insecure Direct Object Reference or unauthorized actions if authorization checks fail).
**Prevention:** Always use cryptographically secure methods like `crypto.randomUUID()` or `crypto.randomBytes()` when generating tokens, identifiers, or secrets for sensitive operations.
