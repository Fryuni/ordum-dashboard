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
import { useStore } from "@nanostores/preact";
import { useRef, useEffect, useCallback } from "preact/hooks";
import {
  $groupSearchQuery,
  $groupHighlightIndex,
  $groupDropdownOpen,
  $groupSelectedItem,
  $groupQuantity,
  $groupSearchResults,
  $groupCanAdd,
  $groupFocusQuantity,
  groupSelectItem,
  groupAddTarget,
} from "../../lib/group-craft-store";

export default function GroupItemPicker() {
  const searchQuery = useStore($groupSearchQuery);
  const highlightIndex = useStore($groupHighlightIndex);
  const dropdownOpen = useStore($groupDropdownOpen);
  const quantity = useStore($groupQuantity);
  const searchResults = useStore($groupSearchResults);
  const canAdd = useStore($groupCanAdd);
  const focusSignal = useStore($groupFocusQuantity);

  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightIndex >= 0 && dropdownRef.current) {
      const el = dropdownRef.current.children[highlightIndex] as HTMLElement;
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        !(e.target instanceof HTMLElement) ||
        !e.target.closest(".item-search-container")
      ) {
        $groupDropdownOpen.set(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (focusSignal > 0) {
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }
  }, [focusSignal]);

  function handleSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    $groupSearchQuery.set(val);
    $groupSelectedItem.set(null);
    $groupHighlightIndex.set(-1);
    $groupDropdownOpen.set(val.trim().length >= 2);
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    const res = $groupSearchResults.get();
    const hi = $groupHighlightIndex.get();

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (
        !$groupDropdownOpen.get() &&
        searchRef.current &&
        searchRef.current.value.trim().length >= 2
      ) {
        $groupDropdownOpen.set(true);
      }
      $groupHighlightIndex.set(Math.min(hi + 1, res.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      $groupHighlightIndex.set(Math.max(hi - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hi >= 0 && hi < res.length) {
        groupSelectItem(res[hi]!);
        setTimeout(() => {
          qtyRef.current?.focus();
          qtyRef.current?.select();
        }, 0);
      }
    } else if (e.key === "Escape") {
      $groupDropdownOpen.set(false);
      $groupHighlightIndex.set(-1);
    }
  }

  function handleSearchFocus() {
    if (
      $groupSearchResults.get().length > 0 &&
      searchRef.current &&
      searchRef.current.value.trim().length >= 2
    ) {
      $groupDropdownOpen.set(true);
    }
  }

  const handleDropdownClick = useCallback((idx: number) => {
    const res = $groupSearchResults.get();
    if (idx >= 0 && idx < res.length) {
      groupSelectItem(res[idx]!);
      setTimeout(() => {
        qtyRef.current?.focus();
        qtyRef.current?.select();
      }, 0);
    }
  }, []);

  function handleQtyInput(e: Event) {
    $groupQuantity.set(parseInt((e.target as HTMLInputElement).value) || 1);
  }

  function handleQtyKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if ($groupSelectedItem.get()) {
        groupAddTarget();
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    }
  }

  function handleAddClick() {
    groupAddTarget();
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <div class="form-row search-row">
      <div class="input-group item-search-container">
        <label for="group-item-search">Search Items</label>
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            class="item-search"
            id="group-item-search"
            placeholder="Type to search items..."
            autocomplete="off"
            ref={searchRef}
            value={searchQuery}
            onInput={handleSearchInput}
            onKeyDown={handleSearchKeydown}
            onFocus={handleSearchFocus}
          />
        </div>
        {dropdownOpen && searchResults.length > 0 && (
          <div class="search-dropdown" ref={dropdownRef}>
            {searchResults.map((r, i) => (
              <button
                type="button"
                class={`search-option ${i === highlightIndex ? "highlighted" : ""}`}
                onClick={() => handleDropdownClick(i)}
                onMouseEnter={() => $groupHighlightIndex.set(i)}
                role="option"
                aria-selected={i === highlightIndex}
                key={`${r.t}-${r.id}`}
              >
                <span class={`tier-badge tier-${r.tier}`}>
                  {r.tier >= 0 ? `T${r.tier}` : "TX"}
                </span>
                <span>{r.n}</span>
                <span class="item-meta">
                  {r.t}
                  {r.tag ? " · " + r.tag : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div class="input-group qty-group">
        <label for="group-qty-input">Quantity</label>
        <input
          type="number"
          class="qty-input"
          id="group-qty-input"
          min={1}
          ref={qtyRef}
          value={quantity}
          onInput={handleQtyInput}
          onKeyDown={handleQtyKeydown}
        />
      </div>
      <div class="btn-group">
        <button
          type="button"
          class="btn btn-primary"
          disabled={!canAdd}
          onClick={handleAddClick}
        >
          Add Item
        </button>
      </div>
    </div>
  );
}
