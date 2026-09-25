## 2024-05-20 - Missing Authentication on Data Endpoints
**Vulnerability:** Core data retrieval routes (GET) across `grn`, `inventory`, `party`, `purchaseOrder`, `sales`, and `sku` modules lacked authentication via `requireAuth` middleware, meaning anyone with the URL could read the data.
**Learning:** `requireAuth` middleware exists in `backend/src/middleware/auth.js` but was not uniformly applied to `GET` requests, unlike `POST`/`PUT`/`DELETE` requests.
**Prevention:** Whenever adding new routes, specifically data-reading endpoints, ensure that the standard `requireAuth` middleware is included in the route definition unless the data is specifically intended to be public.
