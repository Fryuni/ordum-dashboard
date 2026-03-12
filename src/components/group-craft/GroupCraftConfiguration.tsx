import { useEffect } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import {
  $groupItemIndex,
  $groupTargets,
  groupClearAll,
  type IndexItem,
} from "../../lib/group-craft-store";
import GroupItemPicker from "./GroupItemPicker";
import GroupItemList from "./GroupItemList";

interface Props {
  itemIndex: IndexItem[];
}

export default function GroupCraftConfiguration({ itemIndex }: Props) {
  const targets = useStore($groupTargets);

  useEffect(() => {
    $groupItemIndex.set(itemIndex);
  }, [itemIndex]);

  return (
    <div class="planner-card">
      <div class="claim-context">
        <span class="claim-icon">🏰</span>
        <span>Using <strong>Ordum Claim</strong> building storage</span>
      </div>

      <GroupItemPicker />
      <GroupItemList />

      {targets.length > 0 && (
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onClick={groupClearAll}>
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
