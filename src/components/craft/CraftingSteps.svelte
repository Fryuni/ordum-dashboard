<script lang="ts">
  import CraftStep from './CraftStep.svelte';

  interface Props {
    steps: any[];
  }

  let { steps }: Props = $props();
</script>

{#if steps.length > 0}
  <div class="timeline-section">
    <h4>📋 Crafting Steps</h4>
    <div class="timeline">
      {#each steps as step}
        <CraftStep {step} />
      {/each}
    </div>
  </div>
{/if}

<style>
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
</style>
