/**
 * Copyright (C) 2026 Luiz Ferraz
 *
 * This file is part of Ordum Dashboard.
 *
 * Ordum Dashboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Ordum Dashboard is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Ordum Dashboard. If not, see <https://www.gnu.org/licenses/>.
 */
import { useState, useRef, useEffect, useMemo } from "preact/hooks";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  placeholder: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export function MultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const removeTag = (value: string, e: MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.value, o.label);
    return m;
  }, [options]);

  return (
    <div class="input-group source-select-container">
      <label>{label}</label>
      <div
        ref={containerRef}
        class={`multiselect ${open ? "multiselect-open" : ""}`}
      >
        <div
          class="multiselect-control"
          onClick={() => {
            setOpen(!open);
            if (!open) setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          {selected.length === 0 ? (
            <span class="multiselect-placeholder">{placeholder}</span>
          ) : (
            <div class="multiselect-tags">
              {selected.map((v) => (
                <span key={v} class="multiselect-tag">
                  {labelMap.get(v) ?? v}
                  <span
                    class="multiselect-tag-remove"
                    onClick={(e: any) => removeTag(v, e)}
                  >
                    ×
                  </span>
                </span>
              ))}
            </div>
          )}
          <span class="multiselect-arrow">{open ? "▲" : "▼"}</span>
        </div>

        {open && (
          <div class="multiselect-dropdown">
            <input
              ref={inputRef}
              type="text"
              class="multiselect-search"
              placeholder="Search..."
              value={search}
              onInput={(e) =>
                setSearch((e.target as HTMLInputElement).value)
              }
            />
            <div class="multiselect-options">
              {filtered.length === 0 && (
                <div class="multiselect-empty">No matches</div>
              )}
              {filtered.map((opt) => (
                <div
                  key={opt.value}
                  class={`multiselect-option ${selectedSet.has(opt.value) ? "multiselect-option-selected" : ""}`}
                  onClick={() => toggle(opt.value)}
                >
                  <span class="multiselect-check">
                    {selectedSet.has(opt.value) ? "✓" : ""}
                  </span>
                  {opt.label}
                </div>
              ))}
            </div>
            {selected.length > 0 && (
              <div
                class="multiselect-clear"
                onClick={() => {
                  onChange([]);
                  setSearch("");
                }}
              >
                Clear all
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
