## 2024-05-20 - Mongoose Hydration Overhead in Reports
**Learning:** For read-heavy, data-intensive endpoints like reports that fetch many documents, Mongoose document hydration creates a severe performance bottleneck and memory overhead.
**Action:** Always append `.lean()` to `find()` queries for read-only endpoints (like reports, transaction histories) to return plain JS objects and skip Mongoose document hydration.
