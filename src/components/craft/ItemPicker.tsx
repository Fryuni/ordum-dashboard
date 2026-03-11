import { useStore } from '@nanostores/preact';
import { useRef, useEffect, useCallback } from 'preact/hooks';
import {
  $searchQuery,
  $highlightIndex,
  $dropdownOpen,
  $selectedItem,
  $quantity,
  $searchResults,
  $canAdd,
  selectItem,
  addTarget,
} from '../../lib/craft-store';

export default function ItemPicker() {
  const searchQuery = useStore($searchQuery);
  const highlightIndex = useStore($highlightIndex);
  const dropdownOpen = useStore($dropdownOpen);
  const quantity = useStore($quantity);
  const searchResults = useStore($searchResults);
  const canAdd = useStore($canAdd);

  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightIndex >= 0 && dropdownRef.current) {
      const el = dropdownRef.current.children[highlightIndex] as HTMLElement;
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!(e.target instanceof HTMLElement) || !e.target.closest('.item-search-container')) {
        $dropdownOpen.set(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  function handleSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    $searchQuery.set(val);
    $selectedItem.set(null);
    $highlightIndex.set(-1);
    $dropdownOpen.set(val.trim().length >= 2);
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    const res = $searchResults.get();
    const hi = $highlightIndex.get();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!$dropdownOpen.get() && searchRef.current && searchRef.current.value.trim().length >= 2) {
        $dropdownOpen.set(true);
      }
      $highlightIndex.set(Math.min(hi + 1, res.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      $highlightIndex.set(Math.max(hi - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hi >= 0 && hi < res.length) {
        selectItem(res[hi]!);
        setTimeout(() => {
          qtyRef.current?.focus();
          qtyRef.current?.select();
        }, 0);
      }
    } else if (e.key === 'Escape') {
      $dropdownOpen.set(false);
      $highlightIndex.set(-1);
    }
  }

  function handleSearchFocus() {
    if ($searchResults.get().length > 0 && searchRef.current && searchRef.current.value.trim().length >= 2) {
      $dropdownOpen.set(true);
    }
  }

  const handleDropdownClick = useCallback((idx: number) => {
    const res = $searchResults.get();
    if (idx >= 0 && idx < res.length) {
      selectItem(res[idx]!);
      setTimeout(() => {
        qtyRef.current?.focus();
        qtyRef.current?.select();
      }, 0);
    }
  }, []);

  function handleQtyInput(e: Event) {
    $quantity.set(parseInt((e.target as HTMLInputElement).value) || 1);
  }

  function handleQtyKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if ($selectedItem.get()) {
        addTarget();
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    }
  }

  function handleAddClick() {
    addTarget();
    setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <div class="form-row search-row">
      <div class="input-group item-search-container">
        <label for="item-search">Search Items</label>
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            class="item-search"
            id="item-search"
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
                class={`search-option ${i === highlightIndex ? 'highlighted' : ''}`}
                onClick={() => handleDropdownClick(i)}
                onMouseEnter={() => $highlightIndex.set(i)}
                role="option"
                aria-selected={i === highlightIndex}
                key={`${r.t}-${r.id}`}
              >
                <span class={`tier-badge tier-${r.tier}`}>{r.tier >= 0 ? `T${r.tier}` : 'TX'}</span>
                <span>{r.n}</span>
                <span class="item-meta">{r.t}{r.tag ? ' · ' + r.tag : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div class="input-group qty-group">
        <label for="qty-input">Quantity</label>
        <input
          type="number"
          class="qty-input"
          id="qty-input"
          min={1}
          ref={qtyRef}
          value={quantity}
          onInput={handleQtyInput}
          onKeyDown={handleQtyKeydown}
        />
      </div>
      <div class="btn-group">
        <button type="button" class="btn btn-primary" disabled={!canAdd} onClick={handleAddClick}>Add Item</button>
      </div>
    </div>
  );
}
