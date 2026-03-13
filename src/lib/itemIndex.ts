import { gd, type ItemReference } from "./gamedata";

export interface IndexItem extends ItemReference {
  tier: number;
  name: string;
  tag: string;
}

const itemIndex: IndexItem[] = [];

for (const item of gd.items.values()) {
  if (item.name) {
    itemIndex.push({
      item_id: item.id,
      item_type: "Item",
      name: `${item.name} (${item.rarity})`,
      tier: item.tier,
      tag: item.tag,
    });
  }
}
for (const item of gd.cargo.values()) {
  if (item.name) {
    itemIndex.push({
      item_id: item.id,
      item_type: "Cargo",
      name: `${item.name} (${item.rarity})`,
      tier: item.tier,
      tag: item.tag,
    });
  }
}

export { itemIndex };
