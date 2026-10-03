## 2023-10-27 - Mongoose Document Hydration Bottleneck in Reports
**Learning:** Read-heavy Mongoose queries without `.lean()` suffer massive overhead by instantiating Mongoose Document objects instead of Plain Old JavaScript Objects (POJOs).
**Action:** Always append `.lean()` to Mongoose `find()` queries in read-only endpoints, particularly large aggregations or reports, to prevent hydration performance bottlenecks.
