## 2024-03-24 - Missing ARIA Labels on Icon-Only Buttons in Dynamic Forms
**Learning:** Icon-only destructive actions in dynamic forms (like the "✕" button to remove line items) often lack ARIA labels and focus indicators, creating a significant trap for screen reader users and making keyboard navigation difficult.
**Action:** Always add `aria-label` or `title` alongside accessible focus/hover classes (e.g., `focus-visible:ring-2`, `hover:bg-red-50`) to icon-only interactive elements during implementation.

## 2024-11-11 - [Dynamic Pagination State]
**Learning:** Pagination text like "Page X of Y" is invisible to screen reader users when it updates dynamically upon clicking "Next" or "Previous". Standard focus/hover styles were also missing, hurting keyboard users.
**Action:** Always wrap dynamic pagination state indicators in `aria-live="polite"` so screen readers announce the page change automatically. Ensure all interactive table controls have `focus-visible` styles for keyboard navigation.

## 2024-03-24 - Custom Select Listbox Missing Option Roles
**Learning:** Custom combobox/listbox components often use generic buttons without proper ARIA roles, breaking screen reader functionality.
**Action:** Always ensure children of `role="listbox"` have `role="option"` and `aria-selected`, along with visual indicators for the selected state.
