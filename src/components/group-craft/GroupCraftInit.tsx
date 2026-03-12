import { useEffect } from "preact/hooks";
import { $groupTargets, type TargetItem } from "../../lib/group-craft-store";

interface Props {
  /** Pre-populated items from settlement planner (serialized as JSON in URL) */
  initialItems?: TargetItem[];
}

/**
 * Invisible component that initializes group craft targets from props
 * (which come from URL query parameters parsed server-side).
 */
export default function GroupCraftInit({ initialItems }: Props) {
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      $groupTargets.set(initialItems);
    }
  }, []);

  return null;
}
