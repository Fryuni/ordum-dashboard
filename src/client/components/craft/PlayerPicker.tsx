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
import { useRef, useState, useEffect, useCallback } from "preact/hooks";
import { resubaka } from "../../../common/api";
import { $player } from "../../stores/player";

interface PlayerResult {
  entity_id: number;
  username: string;
}

export default function PlayerPicker() {
  const player = useStore($player);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [results, setResults] = useState<PlayerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Debounced API search whenever the player input changes
  useEffect(() => {
    if (debounceRef.current != null) clearTimeout(debounceRef.current);

    const q = player.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const page = await resubaka.listPlayers({
          search: q,
          page: 1,
          per_page: 10,
        });
        setResults(
          page.players.map((p) => ({
            entity_id: p.entity_id,
            username: p.username,
          })),
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    };
  }, [player]);

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
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < results.length) {
        pickPlayer(results[highlightIdx]!.username);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightIdx(-1);
    }
  }

  function handleFocus() {
    if (results.length > 0) setOpen(true);
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
      {open && (results.length > 0 || loading) && (
        <div class="search-dropdown" ref={dropdownRef}>
          {loading && results.length === 0 && (
            <div class="dropdown-loading">Searching…</div>
          )}
          {results.map((m, i) => (
            <button
              type="button"
              class={`search-option ${i === highlightIdx ? "highlighted" : ""}`}
              onClick={() => pickPlayer(m.username)}
              onMouseEnter={() => setHighlightIdx(i)}
              role="option"
              aria-selected={i === highlightIdx}
              key={m.entity_id}
            >
              <span>{m.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
