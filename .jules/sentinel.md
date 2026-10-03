## 2025-02-12 - Fix Information Exposure in API Error Responses
**Vulnerability:** HTTP 500 error handlers were directly returning `err.message` to the client via `res.status(500).json({ error: err.message })`.
**Learning:** Returning unhandled exception messages to the client exposes internal application details, potentially leaking sensitive information (CWE-209).
**Prevention:** Catch blocks should log the detailed error server-side (`console.error(err)`) and return generic error messages like `"Internal server error"` to the client.
