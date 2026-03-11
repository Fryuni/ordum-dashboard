<script lang="ts">
  interface RawMaterial {
    item_id: number;
    item_type: string;
    name: string;
    tier: number;
    tag: string;
    total_needed: number;
    available: number;
    deficit: number;
    source: string;
  }

  interface Props {
    materials: RawMaterial[];
  }

  let { materials }: Props = $props();
</script>

{#if materials.length > 0}
  <div class="raw-section">
    <h4>🌿 Raw Materials Needed</h4>
    <div class="raw-grid">
      {#each materials as r}
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

<style>
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
