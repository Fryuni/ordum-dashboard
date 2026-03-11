<script lang="ts">
  import { onMount } from 'svelte';
  import {
    $itemIndex as itemIndexStore,
    $craftPlan as craftPlanStore,
    $craftRequest as craftRequestStore,
    $canCalculate as canCalculateStore,
    calculate,
    clearAll,
    type IndexItem,
  } from '../../lib/craft-store';
  import PlayerPicker from './PlayerPicker.svelte';
  import ItemPicker from './ItemPicker.svelte';
  import ItemList from './ItemList.svelte';

  interface Props {
    itemIndex: IndexItem[];
    members: { entity_id: number; user_name: string }[];
  }

  let { itemIndex, members = [] }: Props = $props();

  onMount(() => {
    itemIndexStore.set(itemIndex);
  });

  let isLoading = $derived(
    ($craftPlanStore.state === 'loading' && !!$craftRequestStore) ||
    ($craftPlanStore.state === 'loaded' && $craftPlanStore.changing)
  );
</script>

<div class="planner-card">
  <div class="form-row">
    <PlayerPicker {members} />
  </div>

  <ItemPicker />
  <ItemList />

  <div class="form-actions">
    <button
      type="button"
      class="btn btn-large btn-accent"
      disabled={!$canCalculateStore || isLoading}
      onclick={calculate}
    >
      {#if isLoading}⏳ Calculating...{:else}🔍 Calculate Craft Plan{/if}
    </button>
    <button type="button" class="btn btn-large btn-secondary" onclick={clearAll}>Clear All</button>
  </div>
</div>

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
  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }
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
</style>
