import { useState, useEffect } from "preact/hooks";
import { buildCraftUrl } from "../lib/craftUrl";

interface CraftLinkProps {
  items: Array<{ itemType: string; itemId: number; quantity: number }>;
  class?: string;
}

export default function CraftLink({ items, class: cls }: CraftLinkProps) {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;
    buildCraftUrl(items).then(setHref);
  }, [items]);

  if (items.length === 0 || !href) return null;

  return (
    <a
      href={href}
      class={`craft-link ${cls ?? ""}`}
      title="Open in Craft Planner"
    >
      ⚒️ Plan
    </a>
  );
}
