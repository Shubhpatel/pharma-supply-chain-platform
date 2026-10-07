## 2024-10-06 - [Critical Unauthenticated Endpoints]
**Vulnerability:** Several GET endpoints under backend routes (inventory, sales, debitNote, purchaseOrder, creditNote, grn, party, sku) lack the `requireAuth` middleware, exposing sensitive data to unauthenticated access.
**Learning:** Middleware needs to be explicitly applied to each route when not registered globally on the router level, which is a common security pitfall.
**Prevention:** Ensure global route validation or apply `requireAuth` globally in `server.js` or rigorously verify all new routes.
