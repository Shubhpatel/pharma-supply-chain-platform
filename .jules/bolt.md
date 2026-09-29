## 2024-09-29 - [Optimizing Mongoose Read-Heavy Endpoints]
**Learning:** In this codebase's architecture, reporting endpoints that load thousands of records directly from MongoDB without filtering or pagination suffer from severe memory and performance bottlenecks due to Mongoose document hydration overhead.
**Action:** Always append `.lean()` to Mongoose queries on read-only or read-heavy endpoints where full Mongoose document instances are not necessary, significantly reducing memory usage and speeding up execution time.
