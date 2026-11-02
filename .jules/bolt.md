## 2026-10-06 - Mongoose Hydration Bottleneck
**Learning:** For read-only and read-heavy endpoints (like reports or transaction histories), using default Mongoose queries causes severe document hydration performance bottlenecks, as it constructs heavy Mongoose Document objects instead of plain JavaScript objects.
**Action:** Always append `.lean()` to Mongoose queries for endpoints that do not need to mutate and save documents (e.g., reports, history routes) to improve query speed and reduce memory overhead.

## 2026-10-26 - Inline Options Array Mapping in Form Tables
**Learning:** Mapping master data arrays inline inside table row iterations (`skus.map(...)`) causes $O(N \times M)$ object allocations on every single keypress and render in form editors.
**Action:** Always extract and memoize options arrays using `useMemo` at the table editor component level before passing them to child row select components.

## 2026-11-02 - Mongoose N+1 Query Updates Bottleneck
**Learning:** Iteratively updating documents in a loop (e.g., using `findByIdAndUpdate` inside a `for` loop) causes an N+1 query problem, leading to significant I/O bottleneck and performance degradation, especially during batch processing or large transactions.
**Action:** Always use Mongoose's `Model.bulkWrite()` with an array of constructed bulk operations to combine all updates into a single database roundtrip, preventing the N+1 query issue for iterative updates.
