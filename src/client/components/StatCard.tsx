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
interface Props {
  label: string;
  value: string | number;
  icon?: string;
  accent?: string;
}

export default function StatCard({
  label,
  value,
  icon = "📦",
  accent = "var(--accent)",
}: Props) {
  return (
    <div class="stat-card" style={{ "--card-accent": accent } as any}>
      <div class="stat-watermark">{icon}</div>
      <div class="stat-content">
        <div class="stat-value">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div class="stat-label">{label}</div>
      </div>
    </div>
  );
}
