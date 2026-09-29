## 2024-05-24 - Document Hydration Bottleneck
**Learning:** Mongoose queries in read-heavy endpoints (like reports) suffer from significant performance degradation due to document hydration.
**Action:** Always append `.lean()` to `find()` queries in read-only routes (e.g., reports) to bypass Mongoose document hydration, returning plain JavaScript objects for faster execution and lower memory footprint.
