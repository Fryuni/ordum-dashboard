<script lang="ts">
  import type { IndexItem } from '../lib/craft-store';
  import CraftConfiguration from './craft/CraftConfiguration.svelte';
  import CraftingPlan from './craft/CraftingPlan.svelte';

  interface Props {
    itemIndex: IndexItem[];
    members: { entity_id: number; user_name: string }[];
  }

  let { itemIndex, members = [] }: Props = $props();
</script>

<CraftConfiguration {itemIndex} {members} />
<CraftingPlan />
