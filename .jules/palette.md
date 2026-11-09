## 2024-03-24 - Missing ARIA Labels on Icon-Only Buttons in Dynamic Forms
**Learning:** Icon-only destructive actions in dynamic forms (like the "✕" button to remove line items) often lack ARIA labels and focus indicators, creating a significant trap for screen reader users and making keyboard navigation difficult.
**Action:** Always add `aria-label` or `title` alongside accessible focus/hover classes (e.g., `focus-visible:ring-2`, `hover:bg-red-50`) to icon-only interactive elements during implementation.## 2024-03-24 - Modal Form Accessibility Improvements
**Learning:** Form labels separated from their inputs in modals cause severe WCAG violations for screen readers. Icon-only close buttons require explicit aria-labels and focus-visible styles.
**Action:** Always use htmlFor matching the input id. Ensure icon-only buttons have aria-labels and focus-visible styles for keyboard and screen reader access.
