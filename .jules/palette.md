## 2024-03-24 - Missing ARIA Labels on Icon-Only Buttons in Dynamic Forms
**Learning:** Icon-only destructive actions in dynamic forms (like the "✕" button to remove line items) often lack ARIA labels and focus indicators, creating a significant trap for screen reader users and making keyboard navigation difficult.
**Action:** Always add `aria-label` or `title` alongside accessible focus/hover classes (e.g., `focus-visible:ring-2`, `hover:bg-red-50`) to icon-only interactive elements during implementation.

## 2024-11-08 - Added htmlFor to Labels
**Learning:** Auth forms were lacking proper label-to-input associations (`htmlFor` -> `id`), limiting screen reader and keyboard accessibility.
**Action:** Always ensure any `<label>` elements use the `htmlFor` property corresponding to the target `<input>` element's `id`.
