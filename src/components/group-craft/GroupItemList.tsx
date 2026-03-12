import { useStore } from "@nanostores/preact";
import { $groupTargets, groupRemoveTarget } from "../../lib/group-craft-store";

export default function GroupItemList() {
  const targets = useStore($groupTargets);

  if (targets.length === 0) return null;

  return (
    <div class="target-items">
      {targets.map((t, i) => (
        <div class="target-chip" key={`${t.type}-${t.id}`}>
          <span class="name">{t.name}</span>
          <span class="qty">×{t.quantity}</span>
          <button type="button" class="remove" onClick={() => groupRemoveTarget(i)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
