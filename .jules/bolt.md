## 2026-10-06 - Mongoose Hydration Bottleneck
**Learning:** For read-only and read-heavy endpoints (like reports or transaction histories), using default Mongoose queries causes severe document hydration performance bottlenecks, as it constructs heavy Mongoose Document objects instead of plain JavaScript objects.
**Action:** Always append `.lean()` to Mongoose queries for endpoints that do not need to mutate and save documents (e.g., reports, history routes) to improve query speed and reduce memory overhead.

## 2026-10-26 - Inline Options Array Mapping in Form Tables
**Learning:** Mapping master data arrays inline inside table row iterations (`skus.map(...)`) causes $O(N \times M)$ object allocations on every single keypress and render in form editors.
**Action:** Always extract and memoize options arrays using `useMemo` at the table editor component level before passing them to child row select components.

## 2026-11-20 - N+1 Query in Bulk Updates
**Learning:** Performing multiple independent database updates using Mongoose operations (like `findOneAndUpdate`) inside a loop (e.g., iterating through items in a transaction confirmation) leads to poor performance due to multiple network round-trips and DB execution overhead (N+1 query pattern).
**Action:** Use MongoDB's `bulkWrite` with mapped arrays of operations instead of iterative operations to execute all document updates in a single round-trip for large transaction items.

## 2026-11-02 - Bulk Queries for Availability Checks
**Learning:** Performing database queries in loops (N+1 query problem), such as checking stock availability per line item, causes severe latency issues due to repeated database round-trips.
**Action:** Replace iterative query loops with a single bulk query (e.g., using `$or` conditions) combined with `.lean()`, building an in-memory map for $O(1)$ availability checking to significantly reduce latency.

## 2026-11-02 - N+1 Queries in Document Updates
**Learning:** Performing database updates (e.g. `findByIdAndUpdate`) sequentially inside a loop creates N+1 query patterns, leading to significant I/O bottleneck and poor performance, especially for transactions with many items.
**Action:** Always collect sequential database operations into an array and execute them in a single network trip using `Model.bulkWrite()` when updating multiple documents.

## 2024-05-18 - Replacing N+1 queries with bulk operations
**Learning:** Found a pattern where an initial query fetched documents which were iterated over in memory to check conditions, and individual `.save()` calls were executed on documents matching the condition.
**Action:** Replace such N+1 loops by using a single `.updateMany()` operation specifying the same condition, which prevents large memory allocations, network overhead, and database lock times. Also append `.lean()` to any subsequent read-only `.find()` calls to skip Mongoose document hydration.
