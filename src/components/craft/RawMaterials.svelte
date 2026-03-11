<script lang="ts">
  interface RawMaterialSource {
    resource_name: string;
    verb: string;
  }

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
    skill_requirements: { skill: string; level: number }[];
    tool_requirements: { tool: string; level: number }[];
    resource_sources: RawMaterialSource[];
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
              <span class="tier-badge tier-{r.tier}">{r.tier >= 0 ? `T${r.tier}` : 'TX'}</span>
              <span class="raw-title">{r.name}</span>
            </div>
            <span class="raw-source">{r.source || 'Gather'}</span>
          </div>

          {#if r.skill_requirements.length > 0 || r.tool_requirements.length > 0}
            <div class="badges">
              {#each r.skill_requirements as s}
                <span class="badge">⚡ {s.skill} Lv{s.level}</span>
              {/each}
              {#each r.tool_requirements as t}
                <span class="badge">🔧 {t.tool} T{t.level}</span>
              {/each}
            </div>
          {/if}

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

          {#if r.resource_sources.length > 0}
            <div class="sources-tooltip">
              <div class="sources-header">Found in</div>
              <ul class="sources-list">
                {#each r.resource_sources as src}
                  <li>{src.resource_name}</li>
                {/each}
              </ul>
            </div>
          {/if}
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
    position: relative;
    background: var(--bg-surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    transition: border-color 0.2s;
  }
  .raw-card:hover {
    border-color: var(--border-hover);
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
  .badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }
  .badge {
    background: var(--bg-surface-3);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.7rem;
    color: var(--text-muted);
  }
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

  /* Hover tooltip for resource sources */
  .sources-tooltip {
    display: none;
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    min-width: 180px;
    max-width: 280px;
    pointer-events: none;
  }
  .sources-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: var(--border);
  }
  .raw-card:hover .sources-tooltip {
    display: block;
  }
  .sources-header {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    font-weight: 600;
    margin-bottom: 4px;
  }
  .sources-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .sources-list li {
    font-size: 0.78rem;
    color: var(--text);
    padding: 2px 0;
    border-bottom: 1px solid var(--border);
  }
  .sources-list li:last-child {
    border-bottom: none;
  }
</style>
