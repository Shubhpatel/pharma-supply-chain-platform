## 2023-10-26 - Mongoose Lean Queries
**Learning:** In Mongoose, using `find()` returns heavy Mongoose document instances. For read-only operations like generating reports or listing data, instantiating these documents introduces a severe performance bottleneck.
**Action:** Always append `.lean()` to Mongoose queries on read-only endpoints (e.g., reports, lists) to return plain JavaScript objects, improving read performance and reducing memory usage significantly.
