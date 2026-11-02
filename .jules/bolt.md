## 2026-10-06 - Mongoose Hydration Bottleneck
**Learning:** For read-only and read-heavy endpoints (like reports or transaction histories), using default Mongoose queries causes severe document hydration performance bottlenecks, as it constructs heavy Mongoose Document objects instead of plain JavaScript objects.
**Action:** Always append `.lean()` to Mongoose queries for endpoints that do not need to mutate and save documents (e.g., reports, history routes) to improve query speed and reduce memory overhead.

## 2026-10-26 - Inline Options Array Mapping in Form Tables
**Learning:** Mapping master data arrays inline inside table row iterations (`skus.map(...)`) causes $O(N \times M)$ object allocations on every single keypress and render in form editors.
**Action:** Always extract and memoize options arrays using `useMemo` at the table editor component level before passing them to child row select components.

## 2026-11-02 - N+1 Queries in Document Updates
**Learning:** Performing database updates (e.g. `findByIdAndUpdate`) sequentially inside a loop creates N+1 query patterns, leading to significant I/O bottleneck and poor performance, especially for transactions with many items.
**Action:** Always collect sequential database operations into an array and execute them in a single network trip using `Model.bulkWrite()` when updating multiple documents.
