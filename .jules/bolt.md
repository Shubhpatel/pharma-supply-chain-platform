## 2024-09-24 - Unmemoized List Filtering in React
**Learning:** In Next.js client components with complex filtering (like Inventory mapping across arrays and performing reductions), filtering on every render is an anti-pattern. Search inputs trigger re-renders on every keystroke, causing O(N) operations to block the main thread and introduce input lag.
**Action:** Always wrap derived list states (`categories`, `manufacturers`, `filtered`, `products`) with `useMemo` in list pages that feature client-side search/filtering inputs to prevent unnecessary recalculations on keystrokes.
