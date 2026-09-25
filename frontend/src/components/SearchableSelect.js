"use client";

import { useEffect, useId, useState } from "react";

export default function SearchableSelect({ value, onChange, options, placeholder, required = false, className = "", disabled = false }) {
  const selectedOption = options.find((option) => option.value === value);
  const listId = `searchable-select-options-${useId().replaceAll(":", "")}`;
  const [query, setQuery] = useState(selectedOption?.label || "");
  const [open, setOpen] = useState(false);
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!open) {
      setQuery(selectedOption?.label || "");
    }
  }, [selectedOption, open]);

  function selectOption(option) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        required={required && !value}
        disabled={disabled}
        onFocus={() => {
          if (disabled) return;
          setQuery("");
          setOpen(true);
        }}
        onChange={(event) => {
          if (disabled) return;
          setQuery(event.target.value);
          setOpen(true);
          if (!event.target.value) onChange("");
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`w-full border border-gray-300 rounded-md px-3 py-2 text-sm ${disabled ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {open && (
        <div id={listId} role="listbox" className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white py-1 shadow-lg">
          {filteredOptions.length > 0 ? filteredOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
            >
              {option.label}
            </button>
          )) : (
            <div className="px-3 py-2 text-sm text-gray-500">No matches found</div>
          )}
        </div>
      )}
    </div>
  );
}