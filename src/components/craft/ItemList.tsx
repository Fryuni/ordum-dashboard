import { useStore } from "@nanostores/preact";
import { $targets, removeTarget } from "../../lib/craft-store";

export default function ItemList() {
  const targets = useStore($targets);

  if (targets.length === 0) return null;

  return (
    <div class="target-items">
      {targets.map((t, i) => (
        <div class="target-chip" key={`${t.type}-${t.id}`}>
          <span class="name">{t.name}</span>
          <span class="qty">×{t.quantity}</span>
          <button type="button" class="remove" onClick={() => removeTarget(i)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
