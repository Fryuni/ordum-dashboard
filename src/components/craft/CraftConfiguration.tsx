import { useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import {
  $itemIndex,
  $targets,
  clearAll,
  type IndexItem,
} from '../../lib/craft-store';
import PlayerPicker from './PlayerPicker';
import ItemPicker from './ItemPicker';
import ItemList from './ItemList';

interface Props {
  itemIndex: IndexItem[];
  members: { entity_id: number; user_name: string }[];
}

export default function CraftConfiguration({ itemIndex, members = [] }: Props) {
  const targets = useStore($targets);

  useEffect(() => {
    $itemIndex.set(itemIndex);
  }, [itemIndex]);

  return (
    <div class="planner-card">
      <div class="form-row">
        <PlayerPicker members={members} />
      </div>

      <ItemPicker />
      <ItemList />

      {targets.length > 0 && (
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onClick={clearAll}>Clear All</button>
        </div>
      )}
    </div>
  );
}
