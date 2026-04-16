import { useState, useRef, useCallback, useEffect } from "preact/hooks";
import { searchItems, type ItemSearchResult } from "../../common/itemIndex";
import { getItemName } from "../../common/gamedata";
import type { ItemType } from "../../common/gamedata/definition";

export interface SelectedItem {
  itemType: string;
  itemId: number;
  quantity: number;
}

interface ItemPickerProps {
  items: SelectedItem[];
  onChange: (items: SelectedItem[]) => void;
}

export default function ItemPicker({ items, onChange }: ItemPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<ItemSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (q.length >= 2) {
      setResults(searchItems(q, 10));
      setShowResults(true);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, []);

  const addItem = useCallback(
    (result: ItemSearchResult) => {
      const existing = items.find(
        (i) => i.itemType === result.item_type && i.itemId === result.item_id,
      );
      if (!existing) {
        onChange([
          ...items,
          { itemType: result.item_type, itemId: result.item_id, quantity: 1 },
        ]);
      }
      setSearchQuery("");
      setShowResults(false);
    },
    [items, onChange],
  );

  const removeItem = useCallback(
    (index: number) => {
      onChange(items.filter((_, i) => i !== index));
    },
    [items, onChange],
  );

  const updateQuantity = useCallback(
    (index: number, quantity: number) => {
      if (quantity < 1) return;
      onChange(
        items.map((item, i) => (i === index ? { ...item, quantity } : item)),
      );
    },
    [items, onChange],
  );

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div class="item-picker" ref={wrapperRef}>
      <div class="item-picker-search">
        <input
          type="text"
          class="bb-input"
          placeholder="Search items to add..."
          value={searchQuery}
          onInput={(e) => handleSearch((e.target as HTMLInputElement).value)}
          onFocus={() => {
            if (searchQuery.length >= 2) setShowResults(true);
          }}
        />
        {showResults && results.length > 0 && (
          <div class="item-picker-dropdown">
            {results.map((r) => (
              <button
                key={`${r.item_type}:${r.item_id}`}
                type="button"
                class="item-picker-option"
                onClick={() => addItem(r)}
              >
                <span class="item-picker-option-name">{r.name}</span>
                <span class="item-picker-option-meta">
                  T{r.tier} · {r.item_type}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div class="item-picker-selected">
          {items.map((item, i) => (
            <div
              key={`${item.itemType}:${item.itemId}`}
              class="item-picker-tag"
            >
              <span class="item-picker-tag-name">
                {getItemName(item.itemType as ItemType, item.itemId)}
              </span>
              <input
                type="number"
                class="item-picker-qty"
                min="1"
                value={item.quantity}
                onInput={(e) =>
                  updateQuantity(
                    i,
                    parseInt((e.target as HTMLInputElement).value) || 1,
                  )
                }
              />
              <button
                type="button"
                class="item-picker-remove"
                onClick={() => removeItem(i)}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
