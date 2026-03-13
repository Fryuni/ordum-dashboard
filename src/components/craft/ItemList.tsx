import { useStore } from "@nanostores/preact";
import { $targets, removeTarget, editTarget } from "../../lib/craft-store";

export default function ItemList() {
  const targets = useStore($targets);

  if (targets.length === 0) return null;

  return (
    <div class="target-items">
      {targets.map((t, i) => (
        <div class="target-chip" key={`${t.type}-${t.id}`}>
          <span class="name">{t.name}</span>
          <span class="qty">×{t.quantity}</span>
          <button
            type="button"
            class="edit"
            onClick={() => editTarget(i)}
            title="Edit"
          >
            ✏️
          </button>
          <button
            type="button"
            class="remove"
            onClick={() => removeTarget(i)}
            title="Remove"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
