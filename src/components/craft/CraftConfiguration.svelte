<script lang="ts">
  import { onMount } from 'svelte';
  import {
    $itemIndex as itemIndexStore,
    $targets as targetsStore,
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
</script>

<div class="planner-card">
  <div class="form-row">
    <PlayerPicker {members} />
  </div>

  <ItemPicker />
  <ItemList />

  {#if $targetsStore.length > 0}
    <div class="form-actions">
      <button type="button" class="btn btn-secondary" onclick={clearAll}>Clear All</button>
    </div>
  {/if}
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
