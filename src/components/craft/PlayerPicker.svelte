<script lang="ts">
  import { tick } from 'svelte';
  import { $player as player } from '../../lib/craft-store';

  interface Props {
    members: { entity_id: number; user_name: string }[];
  }

  let { members }: Props = $props();

  let open = $state(false);
  let highlightIdx = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state();
  let dropdownEl: HTMLDivElement | undefined = $state();

  let filtered = $derived.by(() => {
    const q = $player.toLowerCase().trim();
    if (q.length === 0) return members;
    return members.filter(m => m.user_name.toLowerCase().includes(q));
  });

  $effect(() => {
    if (highlightIdx >= 0 && dropdownEl) {
      const el = dropdownEl.children[highlightIdx] as HTMLElement;
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  });

  function pickPlayer(name: string) {
    player.set(name);
    open = false;
    highlightIdx = -1;
  }

  function handleInput(e: Event) {
    $player = (e.target as HTMLInputElement).value;
    open = true;
    highlightIdx = -1;
    // If cleared, reset player
    if (!$player.trim()) {
      $player.set('');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) open = true;
      highlightIdx = Math.min(highlightIdx + 1, filtered.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightIdx = Math.max(highlightIdx - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < filtered.length) {
        pickPlayer(filtered[highlightIdx].user_name);
      }
    } else if (e.key === 'Escape') {
      open = false;
      highlightIdx = -1;
    }
  }

  function handleFocus() {
    if (filtered.length > 0) open = true;
  }

  function handleDocumentClick(e: MouseEvent) {
    if (!(e.target instanceof HTMLElement) || !e.target.closest('.player-search-container')) {
      open = false;
    }
  }
</script>

<svelte:document onclick={handleDocumentClick} />

<div class="input-group player-search-container">
  <label for="player-search">Player (optional)</label>
  <div class="search-input-wrapper">
    <span class="search-icon">👤</span>
    <input
      type="text"
      class="player-search"
      id="player-search"
      placeholder="Type to search players..."
      autocomplete="off"
      bind:this={inputEl}
      value={$player}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocus={handleFocus}
    />
    {#if $player}
      <button type="button" class="clear-btn" onclick={() => { $player = ''; open = false; }}>✕</button>
    {/if}
  </div>
  {#if open && filtered.length > 0}
    <div class="search-dropdown" bind:this={dropdownEl}>
      {#each filtered as m, i}
        <button
          type="button"
          class="search-option"
          class:highlighted={i === highlightIdx}
          onclick={() => pickPlayer(m.user_name)}
          onmouseenter={() => highlightIdx = i}
          role="option"
          aria-selected={i === highlightIdx}
        >
          <span>{m.user_name}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
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
  .player-search-container { position: relative; min-width: 200px; }
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
  .player-search {
    width: 100%;
    padding-left: 32px;
    padding-right: 28px;
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 0.85rem;
    outline: none;
    transition: all 0.2s ease;
    height: 34px;
  }
  .player-search:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  .clear-btn {
    position: absolute;
    right: 6px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 2px 4px;
  }
  .clear-btn:hover { color: var(--red); }
  .search-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 100;
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    max-height: 200px;
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
</style>
