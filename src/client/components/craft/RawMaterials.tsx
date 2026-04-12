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
import { memo } from "preact/compat";
import type { RawMaterial } from "../../../common/craft-planner";
import type { PlayerCapabilities } from "../../../common/player-capabilities";

function RawMaterialCard({
  material: r,
  capabilities,
}: {
  material: RawMaterial;
  capabilities?: PlayerCapabilities;
}) {
  const avail = r.available || 0;
  const needed = r.total_needed || 1;
  const deficit = needed - avail;
  const pct = Math.min(100, (avail / needed) * 100);

  const hasWarning = r.missing_skill || r.missing_tool;
  return (
    <div class={`raw-card ${hasWarning ? "raw-unavailable" : ""}`}>
      <div class="raw-card-header">
        <div class="raw-name-row">
          <span class={`tier-badge tier-${r.tier}`}>
            {r.tier >= 0 ? `T${r.tier}` : "TX"}
          </span>
          <span class="raw-title">{r.name}</span>
          <a
            href={`https://bitjita.com/${r.item_type.toLowerCase()}/${r.item_id}`}
            target="_blank"
            rel="noopener noreferrer"
            class="bitjita-link"
            title="View on BitJita"
          >
            <img
              src="https://bitjita.com/bitjitalogo.webp"
              alt="BitJita"
              class="bitjita-icon"
            />
          </a>
        </div>
        <span class="raw-source">{r.source || "Gather"}</span>
      </div>

      {(r.skill_requirements.length > 0 || r.tool_requirements.length > 0) && (
        <div class="badges">
          {r.skill_requirements.map((s) => {
            const playerLevel = capabilities?.hasSkillData
              ? (capabilities.skills.get(s.skill) ?? 0)
              : undefined;
            const isMissing =
              playerLevel !== undefined && playerLevel < s.level;
            return (
              <span
                class={`badge ${isMissing ? "badge-warning" : ""}`}
                key={s.skill}
              >
                ⚡ {s.skill} Lv{s.level}
                {isMissing && (
                  <span class="badge-tooltip">
                    Your {s.skill} is Lv{playerLevel}, need Lv{s.level}
                  </span>
                )}
              </span>
            );
          })}
          {r.tool_requirements.map((t) => {
            const playerTier = capabilities?.hasToolData
              ? (capabilities.maxToolTiers.get(t.tool) ?? 0)
              : undefined;
            const isMissing = playerTier !== undefined && playerTier < t.level;
            return (
              <span
                class={`badge ${isMissing ? "badge-warning" : ""}`}
                key={t.tool}
              >
                🔧 {t.tool} T{t.level}
                {isMissing && (
                  <span class="badge-tooltip">
                    {playerTier === 0
                      ? `You don't have a ${t.tool} (need T${t.level})`
                      : `Your best ${t.tool} is T${playerTier}, need T${t.level}`}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      <div class="raw-stats">
        <span class="avail">
          {avail.toLocaleString()} / {needed.toLocaleString()}
        </span>
        {deficit > 0 ? (
          <span class="deficit">Need {deficit.toLocaleString()}</span>
        ) : (
          <span class="ok">✅</span>
        )}
      </div>
      <div class="progress-bg">
        <div class="progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {r.resource_sources.length > 0 && (
        <div class="sources-tooltip">
          <div class="sources-header">Found in</div>
          <ul class="sources-list">
            {r.resource_sources.map((src) => (
              <li key={src}>{src}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const MemoRawMaterialCard = memo(RawMaterialCard);

export default function RawMaterials({
  materials,
  capabilities,
}: {
  materials: RawMaterial[];
  capabilities?: PlayerCapabilities;
}) {
  if (materials.length === 0) return null;

  return (
    <div class="raw-section">
      <h4>🌿 Raw Materials Needed</h4>
      <div class="raw-grid">
        {materials.map((r) => (
          <MemoRawMaterialCard
            key={`${r.item_type}-${r.item_id}`}
            material={r}
            capabilities={capabilities}
          />
        ))}
      </div>
    </div>
  );
}
