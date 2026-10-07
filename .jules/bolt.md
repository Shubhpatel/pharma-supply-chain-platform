## 2026-10-06 - Mongoose Hydration Bottleneck
**Learning:** For read-only and read-heavy endpoints (like reports or transaction histories), using default Mongoose queries causes severe document hydration performance bottlenecks, as it constructs heavy Mongoose Document objects instead of plain JavaScript objects.
**Action:** Always append `.lean()` to Mongoose queries for endpoints that do not need to mutate and save documents (e.g., reports, history routes) to improve query speed and reduce memory overhead.
