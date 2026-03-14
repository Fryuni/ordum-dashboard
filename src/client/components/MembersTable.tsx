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
import type { MemberInfo } from "../../common/ordum-types";
import { useState } from "preact/hooks";

interface Props {
  members: MemberInfo[];
  claimName: string;
}

export default function MembersTable({ members, claimName }: Props) {
  const [search, setSearch] = useState("");
  const [showOffline, setShowOffline] = useState(true);

  const online = members.filter((m) => m.online);
  const sorted = [...online, ...members.filter((m) => !m.online)];

  const filtered = sorted.filter((m) => {
    if (search && !m.user_name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (!showOffline && !m.online) return false;
    return true;
  });

  return (
    <div class="members-section">
      <div class="section-header">
        <h3>{claimName} — Members</h3>
        <span class="badge">
          {online.length} online · {members.length} total
        </span>
      </div>

      <div class="filters">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            class="search-input custom-input"
            placeholder="Search members..."
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          />
        </div>

        <label class="toggle-label">
          <input
            type="checkbox"
            class="toggle-checkbox"
            checked={showOffline}
            onChange={(e) =>
              setShowOffline((e.target as HTMLInputElement).checked)
            }
          />
          <span class="toggle-slider" />
          <span class="toggle-text">Show offline</span>
        </label>
      </div>

      <div class="table-wrapper">
        <table class="members-table modern-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Name</th>
              <th>Perms</th>
              <th>Top Skills</th>
              <th>Inventory Items</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const topSkills = Object.entries(m.skills)
                .sort(([, a], [, b]) => b.level - a.level)
                .slice(0, 5);
              const perms = [
                m.co_owner_permission && "Co-Owner",
                m.officer_permission && "Officer",
                m.build_permission && "Build",
                m.inventory_permission && "Inventory",
              ].filter(Boolean) as string[];
              return (
                <tr
                  key={m.entity_id}
                  class={m.online ? "online" : "offline-row"}
                >
                  <td>
                    <div class="status-cell">
                      <span
                        class={`status-dot ${m.online ? "online" : "offline"}`}
                      />
                      <span class="status-text">
                        {m.online ? "Online" : "Offline"}
                      </span>
                    </div>
                  </td>
                  <td class="member-name">{m.user_name}</td>
                  <td class="perms-cell">
                    <div class="perms-list">
                      {perms.length > 0 ? (
                        perms.map((p) => (
                          <span key={p} class="perm-badge">
                            {p}
                          </span>
                        ))
                      ) : (
                        <span class="text-muted">—</span>
                      )}
                    </div>
                  </td>
                  <td class="skills-cell">
                    {topSkills.length > 0 ? (
                      <div class="skill-chips">
                        {topSkills.map(([name, s]) => (
                          <span
                            key={name}
                            class="skill-chip"
                            title={`${name}: Lv${s.level} (${s.experience.toLocaleString()} XP, Rank #${s.rank})`}
                          >
                            {name} <strong>{s.level}</strong>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span class="text-muted">—</span>
                    )}
                  </td>
                  <td class="inventory-cell">
                    {m.inventory_items.length > 0 ? (
                      <details class="loc-details">
                        <summary>{m.inventory_items.length} items</summary>
                        <ul class="inv-list">
                          {m.inventory_items.map((item, ii) => (
                            <li key={ii}>
                              <span class="item-name">{item.name}</span>
                              <span class="loc-qty font-mono">
                                ×{item.quantity}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <span class="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
