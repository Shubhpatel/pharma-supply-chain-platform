## 2024-03-24 - [Information Exposure via Error Messages]
**Vulnerability:** Mongoose error messages (e.g., CastError, validation errors) were being exposed directly to the client via `res.status(500).json({ error: err.message })` in `backend/src/routes/auth.routes.js`.
**Learning:** Sending raw database error messages back to the client leaks internal database structure, schema details, and model names, posing an Information Exposure (CWE-209) risk.
**Prevention:** Always catch exceptions in routes and log the sensitive details securely on the server using `console.error` or a logger. Return a sanitized, generic error message (e.g., "An internal server error occurred") to the client.
