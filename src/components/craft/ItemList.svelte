<script lang="ts">
  import {
    $targets as targetsStore,
    removeTarget,
  } from '../../lib/craft-store';
</script>

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

<style>
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
</style>
