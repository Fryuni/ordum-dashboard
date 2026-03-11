import type { IndexItem } from '../lib/craft-store';
import CraftConfiguration from './craft/CraftConfiguration';
import CraftingPlan from './craft/CraftingPlan';

interface Props {
  itemIndex: IndexItem[];
  members: { entity_id: number; user_name: string }[];
}

export default function CraftPlanner({ itemIndex, members = [] }: Props) {
  return (
    <>
      <CraftConfiguration itemIndex={itemIndex} members={members} />
      <CraftingPlan />
    </>
  );
}
