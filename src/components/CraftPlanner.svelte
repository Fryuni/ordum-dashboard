<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    $itemIndex as itemIndexStore,
    $searchQuery as searchQueryStore,
    $highlightIndex as highlightIndexStore,
    $dropdownOpen as dropdownOpenStore,
    $selectedItem as selectedItemStore,
    $quantity as quantityStore,
    $targets as targetsStore,
    $results as resultsStore,
    $loading as loadingStore,
    $error as errorStore,
    $searchResults as searchResultsStore,
    $canAdd as canAddStore,
    $canCalculate as canCalculateStore,
    selectItem,
    addTarget,
    removeTarget,
    clearAll,
    type IndexItem,
  } from '../lib/craft-store';

  interface Props {
    itemIndex: IndexItem[];
    members: { entity_id: number; user_name: string }[];
  }

  let { itemIndex, members = [] }: Props = $props();

  let searchInput: HTMLInputElement | undefined = $state();
  let qtyInput: HTMLInputElement | undefined = $state();
  let dropdownEl: HTMLDivElement | undefined = $state();
  let player = $state('');

  onMount(() => {
    itemIndexStore.set(itemIndex);
  });

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

  function handleAddClick() {
    addTarget();
    tick().then(() => searchInput?.focus());
  }

  function handleClearClick() {
    clearAll();
  }

  async function handleCalculate() {
    const t = targetsStore.get();
    const itemsParam = t.map(t => `${t.type}:${t.id}:${t.quantity}`).join(',');
    const url = `/api/craft-plan?player=${encodeURIComponent(player)}&items=${encodeURIComponent(itemsParam)}`;

    loadingStore.set(true);
    errorStore.set(null);
    resultsStore.set(null);

    try {
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.error) {
        errorStore.set(data.error);
      } else {
        resultsStore.set(data);
      }
    } catch (e: any) {
      errorStore.set(e.message);
    } finally {
      loadingStore.set(false);
    }
  }

  function handleDocumentClick(e: MouseEvent) {
    if (!(e.target instanceof HTMLElement) || !e.target.closest('.item-search-container')) {
      dropdownOpenStore.set(false);
    }
  }
</script>

<svelte:document onclick={handleDocumentClick} />

<div class="planner-card">
  <div class="form-row">
    <div class="input-group">
      <label for="player-select">Player (optional)</label>
      <select class="custom-select" id="player-select" bind:value={player}>
        <option value="">— No player —</option>
        {#each members as m}
          <option value={m.user_name}>{m.user_name}</option>
        {/each}
      </select>
    </div>
  </div>

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

  {#if $targetsStore.length > 0}
    <div class="target-items">
      {#each $targetsStore as t, i}
        <div class="target-chip">
          <span class="name">{t.name}</span>
          <span class="qty">×{t.quantity}</span>
          <button type="button" class="remove" onclick={() => removeTarget(i)}>✕</button>
        </div>
      {/each}
    </div>
  {/if}

  <div class="form-actions">
    <button type="button" class="btn btn-large btn-accent" disabled={!$canCalculateStore || $loadingStore} onclick={handleCalculate}>
      {#if $loadingStore}⏳ Calculating...{:else}🔍 Calculate Craft Plan{/if}
    </button>
    <button type="button" class="btn btn-large btn-secondary" onclick={handleClearClick}>Clear All</button>
  </div>
</div>

{#if $errorStore}
  <div class="loading" style="color: var(--red);">❌ {$errorStore}</div>
{/if}

{#if $loadingStore && !$errorStore}
  <div class="loading">⏳ Calculating craft plan...</div>
{/if}

{#if $resultsStore}
  <div class="results">
    {#if $resultsStore.player}
      <div class="player-context">
        👤 Player: <strong>{$resultsStore.player.username}</strong>
        {#if $resultsStore.player.signed_in}
          <span class="online">● Online</span>
        {:else}
          <span class="offline">○ Offline</span>
        {/if}
        <span class="inv-count">🎒 {$resultsStore.inventory_size} item types</span>
      </div>
    {/if}

    {#each $resultsStore.plans as plan}
      <div class="plan-card">
        <div class="plan-header">
          <h3>⚒️ {plan.target_name} <span class="plan-qty">×{plan.target.quantity}</span></h3>
        </div>

        {#if plan.already_have?.length > 0}
          <div class="already-have">
            <h4>✅ Already Have</h4>
            <div class="have-chips">
              {#each plan.already_have as item}
                <span class="have-chip">{item.name} <strong>×{item.quantity}</strong></span>
              {/each}
            </div>
          </div>
        {/if}

        {#if plan.raw_materials?.length > 0}
          <div class="raw-section">
            <h4>🌿 Raw Materials Needed</h4>
            <div class="raw-grid">
              {#each plan.raw_materials as r}
                {@const avail = r.available || 0}
                {@const needed = r.total_needed || 1}
                {@const deficit = needed - avail}
                {@const pct = Math.min(100, (avail / needed) * 100)}
                <div class="raw-card">
                  <div class="raw-card-header">
                    <div class="raw-name-row">
                      <span class="tier-badge tier-{r.tier}">T{r.tier}</span>
                      <span class="raw-title">{r.name}</span>
                    </div>
                    <span class="raw-source">{r.source || 'Gather'}</span>
                  </div>
                  <div class="raw-stats">
                    <span class="avail">{avail.toLocaleString()} / {needed.toLocaleString()}</span>
                    {#if deficit > 0}
                      <span class="deficit">Need {deficit.toLocaleString()}</span>
                    {:else}
                      <span class="ok">✅</span>
                    {/if}
                  </div>
                  <div class="progress-bg">
                    <div class="progress-fill" style="width: {pct}%"></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if plan.steps?.length > 0}
          <div class="timeline-section">
            <h4>📋 Crafting Steps</h4>
            <div class="timeline">
              {#each plan.steps as step}
                <div class="timeline-step">
                  <div class="timeline-node">{step.depth + 1}</div>
                  <div class="timeline-card">
                    <div class="step-header">
                      <span class="step-title">{step.output_name}</span>
                      <span class="step-qty">×{step.craft_count} craft{step.craft_count > 1 ? 's' : ''} → {step.total_output} output</span>
                      <div class="badges">
                        {#if step.building_type}
                          <span class="badge">🏠 {step.building_type}{step.building_tier ? ' T' + step.building_tier : ''}</span>
                        {/if}
                        {#each step.skill_requirements || [] as s}
                          <span class="badge">⚡ {s.skill} Lv{s.level}</span>
                        {/each}
                        {#each step.tool_requirements || [] as t}
                          <span class="badge">🔧 {t.tool}</span>
                        {/each}
                      </div>
                    </div>
                    <div class="input-grid">
                      {#each step.inputs as inp}
                        {@const d = inp.deficit > 0}
                        <div class="input-card" class:deficit={d} class:ok={!d}>
                          <span class="input-name">{inp.name}</span>
                          <span class="input-qty" class:deficit={d} class:ok={!d}>
                            {inp.available || 0} / {inp.total_needed}{d ? ' (need ' + inp.deficit + ')' : ''}
                          </span>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if !plan.steps?.length && !plan.raw_materials?.length}
          <div class="all-done">✅ You already have everything needed!</div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .planner-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
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
  .custom-select, .item-search, .qty-input {
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
  .custom-select:focus, .item-search:focus, .qty-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  .custom-select { min-width: 200px; cursor: pointer; }
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
  .btn-large { font-size: 0.9rem; padding: 0 24px; }
  .btn-accent { background: var(--accent); color: #fff; }
  .btn-accent:hover:not(:disabled) {
    background: #5b7be5;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--accent-glow);
  }
  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
  }
  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-surface-2);
    border-color: var(--border-hover);
  }
  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
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
  .target-items {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .target-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--accent-glow);
    border: 1px solid rgba(108, 140, 255, 0.2);
    border-radius: 16px;
    padding: 4px 12px;
    font-size: 0.8rem;
  }
  .target-chip .name { font-weight: 500; }
  .target-chip .qty { color: var(--accent-4); font-weight: 600; }
  .target-chip .remove {
    background: none;
    border: none;
    color: var(--red);
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0 2px;
    opacity: 0.7;
    transition: opacity 0.15s;
  }
  .target-chip .remove:hover { opacity: 1; }
  .loading {
    text-align: center;
    padding: 24px;
    color: var(--text-muted);
    font-size: 0.95rem;
  }
  .player-context {
    margin-bottom: 16px;
    color: var(--text-muted);
    font-size: 0.85rem;
  }
  .player-context strong { color: var(--text); }
  .player-context .online { color: var(--green); margin-left: 8px; }
  .player-context .offline { color: var(--text-muted); margin-left: 8px; }
  .player-context .inv-count { margin-left: 12px; }
  .plan-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
  }
  .plan-header {
    padding-bottom: 12px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  .plan-header h3 {
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
  }
  .plan-qty { color: var(--accent-4); }
  .already-have { margin-bottom: 16px; }
  .already-have h4 {
    font-size: 0.85rem;
    margin-bottom: 8px;
    color: var(--green);
  }
  .have-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .have-chip {
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.2);
    color: var(--green);
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 0.78rem;
  }
  .raw-section { margin-bottom: 16px; }
  .raw-section h4 { font-size: 0.9rem; margin-bottom: 10px; }
  .raw-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }
  .raw-card {
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
  }
  .raw-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .raw-name-row { display: flex; gap: 8px; align-items: center; }
  .raw-title { font-size: 0.82rem; font-weight: 500; }
  .raw-source { font-size: 0.7rem; color: var(--text-muted); }
  .raw-stats {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    margin-bottom: 6px;
  }
  .raw-stats .avail { font-family: monospace; }
  .raw-stats .deficit { color: var(--red); font-weight: 600; }
  .raw-stats .ok { color: var(--green); }
  .progress-bg {
    height: 4px;
    background: var(--bg-surface-3);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--green);
    border-radius: 2px;
    transition: width 0.3s ease;
  }
  .timeline-section h4 { font-size: 0.9rem; margin-bottom: 12px; }
  .timeline {
    position: relative;
    padding-left: 36px;
  }
  .timeline::before {
    content: '';
    position: absolute;
    left: 11px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--border);
  }
  .timeline-step {
    position: relative;
    margin-bottom: 10px;
  }
  .timeline-node {
    position: absolute;
    left: -36px;
    top: 12px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--bg-surface);
    border: 2px solid var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--accent);
  }
  .timeline-card {
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    transition: border-color 0.2s;
  }
  .timeline-card:hover { border-color: var(--border-hover); }
  .step-header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .step-title { font-weight: 600; font-size: 0.88rem; }
  .step-qty { font-size: 0.78rem; color: var(--text-muted); }
  .badges { display: flex; gap: 6px; flex-wrap: wrap; }
  .badge {
    background: var(--bg-surface-3);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    color: var(--text-muted);
  }
  .input-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 6px;
  }
  .input-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
  }
  .input-card.deficit { border-color: rgba(248, 113, 113, 0.3); }
  .input-card.ok { border-color: rgba(74, 222, 128, 0.2); }
  .input-name { font-weight: 500; }
  .input-qty { font-family: monospace; font-size: 0.75rem; }
  .input-qty.deficit { color: var(--red); }
  .input-qty.ok { color: var(--green); }
  .all-done {
    padding: 16px;
    color: var(--text-muted);
    text-align: center;
  }
</style>