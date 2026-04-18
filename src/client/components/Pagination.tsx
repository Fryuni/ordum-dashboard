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
/**
 * Simple page-number pagination control.
 *
 * Renders up to `windowSize` page-number buttons centered on the current page,
 * with first/last/prev/next buttons. Keeps the UI stable for small page counts
 * and falls back to a sliding window for large ones.
 */
interface Props {
  page: number; // zero-based
  totalPages: number;
  onPageChange: (page: number) => void;
  windowSize?: number;
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  windowSize = 5,
}: Props) {
  if (totalPages <= 1) return null;

  const half = Math.floor(windowSize / 2);
  let start = Math.max(0, page - half);
  let end = Math.min(totalPages - 1, start + windowSize - 1);
  start = Math.max(0, end - windowSize + 1);

  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div class="pagination">
      <button
        type="button"
        class="pagination-btn"
        disabled={page === 0}
        onClick={() => onPageChange(0)}
        title="First page"
      >
        «
      </button>
      <button
        type="button"
        class="pagination-btn"
        disabled={page === 0}
        onClick={() => onPageChange(page - 1)}
        title="Previous page"
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          class={`pagination-btn ${p === page ? "active" : ""}`}
          onClick={() => onPageChange(p)}
        >
          {p + 1}
        </button>
      ))}
      <button
        type="button"
        class="pagination-btn"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
        title="Next page"
      >
        ›
      </button>
      <button
        type="button"
        class="pagination-btn"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(totalPages - 1)}
        title="Last page"
      >
        »
      </button>
    </div>
  );
}
