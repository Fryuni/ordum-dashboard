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
import type { RawMaterial } from "../../../common/craft-planner";

export default function RawMaterials({
  materials,
}: {
  materials: RawMaterial[];
}) {
  if (materials.length === 0) return null;

  return (
    <div class="raw-section">
      <h4>🌿 Raw Materials Needed</h4>
      <div class="raw-grid">
        {materials.map((r) => {
          const avail = r.available || 0;
          const needed = r.total_needed || 1;
          const deficit = needed - avail;
          const pct = Math.min(100, (avail / needed) * 100);

          return (
            <div class="raw-card" key={`${r.item_type}-${r.item_id}`}>
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

              {(r.skill_requirements.length > 0 ||
                r.tool_requirements.length > 0) && (
                <div class="badges">
                  {r.skill_requirements.map((s) => (
                    <span class="badge" key={s.skill}>
                      ⚡ {s.skill} Lv{s.level}
                    </span>
                  ))}
                  {r.tool_requirements.map((t) => (
                    <span class="badge" key={t.tool}>
                      🔧 {t.tool} T{t.level}
                    </span>
                  ))}
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
                      <li key={src.resource_name}>{src.resource_name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
