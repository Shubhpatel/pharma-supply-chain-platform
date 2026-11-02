"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function SearchableSelect({ value, onChange, options, onSearch, placeholder, required = false, className = "", disabled = false }) {
  // ⚡ Bolt: Memoize selected option lookup and filtered list to prevent redundant array ops on unrelated parent re-renders
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );
  const listId = `searchable-select-options-${useId().replaceAll(":", "")}`;
  const inputRef = useRef(null);
  const [query, setQuery] = useState(selectedOption?.label || "");
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const filteredOptions = useMemo(
    () => options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  );

  useEffect(() => {
    if (!onSearch || query.trim().length < 3) return undefined;
    const timer = setTimeout(() => onSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [onSearch, query]);

  useEffect(() => {
    if (selectedOption && !open) setQuery(selectedOption.label);
  }, [selectedOption, open]);

  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;

    function updateMenuPosition() {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      const menuHeight = Math.min(Math.max(filteredOptions.length, 1) * 36 + 8, 240);
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < menuHeight && rect.top >= menuHeight
        ? rect.top - menuHeight - 4
        : rect.bottom + 4;
      setMenuPosition({ top, left: rect.left, width: rect.width });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, listId, filteredOptions.length]);

  function selectOption(option) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        ref={inputRef}
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
      {open && menuPosition && createPortal(
        <div
          id={listId}
          role="listbox"
          style={menuPosition}
          className="fixed z-[100] max-h-60 overflow-y-auto overflow-x-hidden rounded-md border border-gray-300 bg-white py-1 shadow-lg"
        >
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
        </div>,
        document.body
      )}
    </div>
  );
}