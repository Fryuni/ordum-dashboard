/**
 * Copyright (C) 2026 Luiz Ferraz
 *
 * This file is part of Ordum Dashboard.
 *
 * Ordum Dashboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Ordum Dashboard is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Ordum Dashboard. If not, see <https://www.gnu.org/licenses/>.
 */
import { useStore } from "@nanostores/preact";
import {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "preact/hooks";
import { $player } from "../../lib/stores/craftSource";

interface Props {
  members: { entity_id: string; user_name: string }[];
}

export default function PlayerPicker({ members }: Props) {
  const player = useStore($player);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = player.toLowerCase().trim();
    if (q.length === 0) return members;
    return members.filter((m) => m.user_name.toLowerCase().includes(q));
  }, [player, members]);

  useEffect(() => {
    if (highlightIdx >= 0 && dropdownRef.current) {
      const el = dropdownRef.current.children[highlightIdx] as HTMLElement;
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        !(e.target instanceof HTMLElement) ||
        !e.target.closest(".player-search-container")
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const pickPlayer = useCallback((name: string) => {
    $player.set(name);
    setOpen(false);
    setHighlightIdx(-1);
  }, []);

  function handleInput(e: Event) {
    $player.set((e.target as HTMLInputElement).value);
    setOpen(true);
    setHighlightIdx(-1);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < filtered.length) {
        pickPlayer(filtered[highlightIdx]!.user_name);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightIdx(-1);
    }
  }

  function handleFocus() {
    if (filtered.length > 0) setOpen(true);
  }

  return (
    <div class="input-group player-search-container">
      <label for="player-search">Player (optional)</label>
      <div class="search-input-wrapper">
        <span class="search-icon">👤</span>
        <input
          type="text"
          class="player-search"
          id="player-search"
          placeholder="Type to search players..."
          autocomplete="off"
          ref={inputRef}
          value={player}
          onInput={handleInput}
          onKeyDown={handleKeydown}
          onFocus={handleFocus}
        />
        {player && (
          <button
            type="button"
            class="clear-btn"
            onClick={() => {
              $player.set("");
              setOpen(false);
            }}
          >
            ✕
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div class="search-dropdown" ref={dropdownRef}>
          {filtered.map((m, i) => (
            <button
              type="button"
              class={`search-option ${i === highlightIdx ? "highlighted" : ""}`}
              onClick={() => pickPlayer(m.user_name)}
              onMouseEnter={() => setHighlightIdx(i)}
              role="option"
              aria-selected={i === highlightIdx}
              key={m.entity_id}
            >
              <span>{m.user_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
