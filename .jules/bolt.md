## 2024-10-04 - Mongoose Document Hydration Bottleneck
**Learning:** Mongoose document hydration is a severe performance bottleneck for read-heavy endpoints (like reports or transaction histories). Without `.lean()`, Mongoose creates full, heavy document instances which consumes significant memory and CPU time.
**Action:** Use `.lean()` on all read-heavy, list-fetching endpoint Mongoose queries to return plain JavaScript objects instead of hydrated Mongoose documents, dramatically improving speed and reducing memory usage.
