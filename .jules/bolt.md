## 2026-10-06 - Mongoose Hydration Bottleneck
**Learning:** For read-only and read-heavy endpoints (like reports or transaction histories), using default Mongoose queries causes severe document hydration performance bottlenecks, as it constructs heavy Mongoose Document objects instead of plain JavaScript objects.
**Action:** Always append `.lean()` to Mongoose queries for endpoints that do not need to mutate and save documents (e.g., reports, history routes) to improve query speed and reduce memory overhead.

## 2026-10-26 - Inline Options Array Mapping in Form Tables
**Learning:** Mapping master data arrays inline inside table row iterations (`skus.map(...)`) causes $O(N \times M)$ object allocations on every single keypress and render in form editors.
**Action:** Always extract and memoize options arrays using `useMemo` at the table editor component level before passing them to child row select components.
