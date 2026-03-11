<script lang="ts">
  import { $craftPlan as craftPlanStore, $craftRequest as craftRequestStore } from '../../lib/craft-store';
  import RawMaterials from './RawMaterials.svelte';
  import CraftingSteps from './CraftingSteps.svelte';
</script>

{#if $craftPlanStore.state === 'failed'}
  <div class="loading" style="color: var(--red);">❌ {$craftPlanStore.error}</div>
{/if}

{#if $craftPlanStore.state === 'loading' && $craftRequestStore}
  <div class="loading">⏳ Calculating craft plan...</div>
{/if}

{#if $craftPlanStore.state === 'loaded' && $craftPlanStore.value}
  {@const results = $craftPlanStore.value}
  <div class="results">
    {#if results.player}
      <div class="player-context">
        👤 Player: <strong>{results.player.username}</strong>
        {#if results.player.signed_in}
          <span class="online">● Online</span>
        {:else}
          <span class="offline">○ Offline</span>
        {/if}
        <span class="inv-count">🎒 {results.inventory_size} item types</span>
      </div>
    {/if}

    {#each results.plans as plan}
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

        <RawMaterials materials={plan.raw_materials ?? []} />
        <CraftingSteps steps={plan.steps ?? []} />

        {#if !plan.steps?.length && !plan.raw_materials?.length}
          <div class="all-done">✅ You already have everything needed!</div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
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
  .all-done {
    padding: 16px;
    color: var(--text-muted);
    text-align: center;
  }
</style>
