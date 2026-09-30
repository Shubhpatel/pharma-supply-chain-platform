## 2026-09-29 - Error Handling Exposing Internal Details
**Vulnerability:** Found 60 instances of returning raw `err.message` directly to clients in HTTP 500/400 responses across multiple routes.
**Learning:** This exposes implementation details (like file paths, DB schema internals, and query failures) which violates CWE-209 (Information Exposure Through an Error Message).
**Prevention:** Replace direct `res.status(500).json({ error: err.message })` with a generic client-facing message like 'Internal server error' and log the actual error stack/message securely on the server.
