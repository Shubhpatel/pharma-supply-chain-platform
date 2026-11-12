"use client";

const PAGE_SIZE_OPTIONS = [10, 15, 30, 50, 100];

export default function PaginationControls({ page, limit, total, onPageChange, onLimitChange }) {
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3 text-sm text-gray-600">
      <label className="flex items-center gap-2">
        Rows per page
        <select
          value={limit}
          onChange={(event) => onLimitChange(Number(event.target.value))}
          className="rounded-md border border-gray-300 px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 transition-colors"
        >
          {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <span aria-live="polite" className="tabular-nums">Page {page} of {totalPages} ({total} rows)</span>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page" className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 transition-colors disabled:opacity-40 disabled:hover:bg-transparent">Previous</button>
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page" className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 transition-colors disabled:opacity-40 disabled:hover:bg-transparent">Next</button>
      </div>
    </div>
  );
}
