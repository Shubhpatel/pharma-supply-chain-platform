## 2026-09-27 - [Input Type Validation to Prevent NoSQL Injection and DoS]
**Vulnerability:** A lack of strict type checking on `req.body.email` (and other string fields) allowed sending an object like `{"$gt": ""}`.
**Learning:** This caused two issues in this specific codebase pattern:
  1. `TypeError: email.toLowerCase is not a function` because `.toLowerCase()` was called on an object, resulting in an unhandled exception or 500 error, creating a Denial of Service (DoS) vector.
  2. If type coercion or bypassed methods were present, it could lead directly to NoSQL Injection where Mongoose would accept the object as a query parameter in `User.findOne`.
**Prevention:** Always enforce strict `typeof x === 'string'` checks before performing string operations (like `.toLowerCase()`) and before passing user input into Mongoose queries.