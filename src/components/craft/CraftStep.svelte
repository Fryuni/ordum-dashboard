<script lang="ts">
  interface StepInput {
    name: string;
    total_needed: number;
    available: number;
    deficit: number;
  }

  interface Step {
    depth: number;
    output_name: string;
    craft_count: number;
    total_output: number;
    building_type: string;
    building_tier: number;
    skill_requirements: { skill: string; level: number }[];
    tool_requirements: { tool: string; level: number }[];
    inputs: StepInput[];
  }

  interface Props {
    step: Step;
  }

  let { step }: Props = $props();
</script>

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

<style>
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
</style>
