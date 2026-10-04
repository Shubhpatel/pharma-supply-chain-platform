## 2026-10-04 - [Fix Info Leakage in Error Responses]
**Vulnerability:** Express routes were directly exposing internal `err.message` in HTTP 500 error responses across all controllers.
**Learning:** Returning unhandled exception messages to the client exposes implementation details, potential stack traces, or database schema hints to attackers (CWE-209).
**Prevention:** Always log raw errors securely on the server (`console.error` or proper logger) and return sanitized, generic error messages (e.g., "An unexpected error occurred") to the client in generic catch blocks.
