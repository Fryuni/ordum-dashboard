<script lang="ts">
  import { tick } from 'svelte';
  import {
    $searchQuery as searchQueryStore,
    $highlightIndex as highlightIndexStore,
    $dropdownOpen as dropdownOpenStore,
    $selectedItem as selectedItemStore,
    $quantity as quantityStore,
    $searchResults as searchResultsStore,
    $canAdd as canAddStore,
    selectItem,
    addTarget,
  } from '../../lib/craft-store';

  let searchInput: HTMLInputElement | undefined = $state();
  let qtyInput: HTMLInputElement | undefined = $state();
  let dropdownEl: HTMLDivElement | undefined = $state();

  // Scroll highlighted option into view
  $effect(() => {
    const hi = $highlightIndexStore;
    if (hi >= 0 && dropdownEl) {
      const el = dropdownEl.children[hi] as HTMLElement;
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  });

  function handleSearchInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    searchQueryStore.set(val);
    selectedItemStore.set(null);
    highlightIndexStore.set(-1);
    dropdownOpenStore.set(val.trim().length >= 2);
  }

  function handleSearchKeydown(e: KeyboardEvent) {
    const res = searchResultsStore.get();
    const hi = highlightIndexStore.get();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!dropdownOpenStore.get() && searchInput && searchInput.value.trim().length >= 2) {
        dropdownOpenStore.set(true);
      }
      highlightIndexStore.set(Math.min(hi + 1, res.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightIndexStore.set(Math.max(hi - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hi >= 0 && hi < res.length) {
        selectItem(res[hi]);
        tick().then(() => {
          qtyInput?.focus();
          qtyInput?.select();
        });
      }
    } else if (e.key === 'Escape') {
      dropdownOpenStore.set(false);
      highlightIndexStore.set(-1);
    }
  }

  function handleSearchFocus() {
    if (searchResultsStore.get().length > 0 && searchInput && searchInput.value.trim().length >= 2) {
      dropdownOpenStore.set(true);
    }
  }

  function handleDropdownClick(idx: number) {
    const res = searchResultsStore.get();
    if (idx >= 0 && idx < res.length) {
      selectItem(res[idx]);
      tick().then(() => {
        qtyInput?.focus();
        qtyInput?.select();
      });
    }
  }

  function handleQtyInput(e: Event) {
    quantityStore.set(parseInt((e.target as HTMLInputElement).value) || 1);
  }

  function handleQtyKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedItemStore.get()) {
        addTarget();
        tick().then(() => {
          searchInput?.focus();
        });
      }
    }
  }

  export function focusSearch() {
    searchInput?.focus();
  }

  function handleAddClick() {
    addTarget();
    tick().then(() => searchInput?.focus());
  }

  function handleDocumentClick(e: MouseEvent) {
    if (!(e.target instanceof HTMLElement) || !e.target.closest('.item-search-container')) {
      dropdownOpenStore.set(false);
    }
  }
</script>

<svelte:document onclick={handleDocumentClick} />

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
        bind:this={searchInput}
        value={$searchQueryStore}
        oninput={handleSearchInput}
        onkeydown={handleSearchKeydown}
        onfocus={handleSearchFocus}
      />
    </div>
    {#if $dropdownOpenStore && $searchResultsStore.length > 0}
      <div class="search-dropdown" bind:this={dropdownEl}>
        {#each $searchResultsStore as r, i}
          <button
            type="button"
            class="search-option"
            class:highlighted={i === $highlightIndexStore}
            onclick={() => handleDropdownClick(i)}
            onmouseenter={() => highlightIndexStore.set(i)}
            role="option"
            aria-selected={i === $highlightIndexStore}
          >
            <span class="tier-badge tier-{r.tier}">T{r.tier}</span>
            <span>{r.n}</span>
            <span class="item-meta">{r.t}{r.tag ? ' · ' + r.tag : ''}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <div class="input-group qty-group">
    <label for="qty-input">Quantity</label>
    <input
      type="number"
      class="qty-input"
      id="qty-input"
      min="1"
      bind:this={qtyInput}
      value={$quantityStore}
      oninput={handleQtyInput}
      onkeydown={handleQtyKeydown}
    />
  </div>
  <div class="btn-group">
    <button type="button" class="btn btn-primary" disabled={!$canAddStore} onclick={handleAddClick}>Add Item</button>
  </div>
</div>

<style>
  .form-row {
    display: flex;
    gap: 16px;
    margin-bottom: 10px;
    flex-wrap: wrap;
    align-items: flex-end;
  }
  .input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .input-group label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    font-weight: 600;
  }
  .item-search, .qty-input {
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 0.85rem;
    outline: none;
    transition: all 0.2s ease;
    height: 34px;
    padding: 0 12px;
  }
  .item-search:focus, .qty-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  .item-search-container { position: relative; flex: 1; min-width: 240px; }
  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  .search-icon {
    position: absolute;
    left: 10px;
    font-size: 0.9rem;
    pointer-events: none;
  }
  .item-search {
    width: 100%;
    padding-left: 32px;
  }
  .qty-group { width: 90px; }
  .qty-input { width: 100%; }
  .btn-group { padding-bottom: 0; }
  .btn {
    height: 34px;
    padding: 0 16px;
    border: none;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-primary {
    background: var(--bg-surface-2);
    border: 1px solid var(--accent);
    color: var(--accent);
  }
  .btn-primary:hover:not(:disabled) { background: var(--accent-glow); }
  .search-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 100;
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    max-height: 280px;
    overflow-y: auto;
    box-shadow: 0 12px 32px rgba(0,0,0,0.4);
    padding: 4px;
  }
  .search-option {
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 6px;
    transition: background 0.15s;
    background: none;
    border: none;
    color: var(--text);
  }
  .search-option:hover, .search-option.highlighted {
    background: var(--bg-surface-3);
  }
  .item-meta {
    color: var(--text-muted);
    font-size: 0.75rem;
    margin-left: auto;
  }
  .tier-badge {
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .tier-1 { background: #374151; color: #d1d5db; }
  .tier-2 { background: #1e3a2f; color: #6ee7b7; }
  .tier-3 { background: #1e2a3f; color: #93c5fd; }
  .tier-4 { background: #2d1f3f; color: #c4b5fd; }
  .tier-5 { background: #3f2d1f; color: #fcd34d; }
  .tier--1, .tier-0 { background: #2d2d2d; color: #9ca3af; }
</style>
