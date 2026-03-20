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
import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import {
  $empireClaims,
  $empireClaimsLoading,
  fetchEmpireClaims,
} from "../stores/craftSource";
import { ORDUM_MAIN_CLAIM_ID } from "../../common/ordum-types";
import type { StorageAuditResponse, StorageAuditChartPoint } from "../../server/storage-audit";

// ─── Chart Component (pure canvas) ─────────────────────────────────────────────

function StorageChart({ data }: { data: StorageAuditChartPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 24, right: 16, bottom: 40, left: 60 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Find value range
    const maxCum = Math.max(...data.map((d) => d.cumulative), 0);
    const minCum = Math.min(...data.map((d) => d.cumulative), 0);
    const range = maxCum - minCum || 1;
    const yScale = plotH / (range * 1.1);
    const yOffset = maxCum * 1.05;

    const barW = Math.max(2, (plotW / data.length) * 0.7);
    const gap = plotW / data.length;

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const y = pad.top + (plotH / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      // Y-axis labels
      const val = yOffset - (plotH / gridSteps / yScale) * i;
      ctx.fillStyle = "#7c8495";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(formatCompact(val), pad.left - 8, y + 4);
    }

    // Cumulative line
    ctx.beginPath();
    ctx.strokeStyle = "#6c8cff";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    for (let i = 0; i < data.length; i++) {
      const x = pad.left + gap * i + gap / 2;
      const y = pad.top + (yOffset - data[i]!.cumulative) * yScale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Area fill under cumulative
    ctx.lineTo(pad.left + gap * (data.length - 1) + gap / 2, pad.top + plotH);
    ctx.lineTo(pad.left + gap / 2, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = "rgba(108, 140, 255, 0.08)";
    ctx.fill();

    // Deposit/withdraw bars
    const maxBar = Math.max(
      ...data.map((d) => Math.max(d.deposits, d.withdrawals)),
      1,
    );
    const barScale = (plotH * 0.3) / maxBar;

    for (let i = 0; i < data.length; i++) {
      const x = pad.left + gap * i + (gap - barW * 2) / 2;
      const baseY = pad.top + plotH;

      // Deposit bar (green, going up from bottom)
      const point = data[i]!;
      if (point.deposits > 0) {
        const bh = point.deposits * barScale;
        ctx.fillStyle = "rgba(74, 222, 128, 0.5)";
        ctx.fillRect(x, baseY - bh, barW, bh);
      }

      // Withdraw bar (red, going up from bottom)
      if (point.withdrawals > 0) {
        const bh = point.withdrawals * barScale;
        ctx.fillStyle = "rgba(248, 113, 113, 0.5)";
        ctx.fillRect(x + barW, baseY - bh, barW, bh);
      }
    }

    // X-axis labels (show subset to avoid overlap)
    ctx.fillStyle = "#7c8495";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    const maxLabels = Math.floor(plotW / 70);
    const labelStep = Math.max(1, Math.ceil(data.length / maxLabels));
    for (let i = 0; i < data.length; i += labelStep) {
      const x = pad.left + gap * i + gap / 2;
      const label = data[i]!.date.slice(5); // MM-DD
      ctx.fillText(label, x, h - pad.bottom + 16);
    }

    // Zero line if range crosses zero
    if (minCum < 0 && maxCum > 0) {
      const zeroY = pad.top + yOffset * yScale;
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, zeroY);
      ctx.lineTo(w - pad.right, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [data]);

  if (data.length === 0) {
    return (
      <div class="chart-empty">
        <span class="text-muted">No data to chart yet</span>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style="width: 100%; height: 280px; display: block"
    />
  );
}

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toString();
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

// ─── Page Component ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function StorageAuditPage() {
  const claims = useStore($empireClaims);
  const claimsLoading = useStore($empireClaimsLoading);

  const [selectedClaim, setSelectedClaim] = useState(ORDUM_MAIN_CLAIM_ID);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<StorageAuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEmpireClaims();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedClaim, selectedPlayer, selectedItem]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!selectedClaim) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        claim: selectedClaim,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (selectedPlayer) params.set("player", selectedPlayer);
      if (selectedItem) {
        // selectedItem format: "Type:id" e.g. "Item:2130001"
        const [type, id] = selectedItem.split(":");
        if (type && id) {
          params.set("itemType", type);
          params.set("itemId", id);
        }
      }

      const resp = await fetch(`/api/storage-audit?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result: StorageAuditResponse = await resp.json();
      setData(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedClaim, selectedPlayer, selectedItem, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh while ingesting
  useEffect(() => {
    if (!data?.ingesting) return;
    const timer = setTimeout(fetchData, 5000);
    return () => clearTimeout(timer);
  }, [data?.ingesting, fetchData]);

  const totalPages = data ? Math.ceil(data.totalCount / PAGE_SIZE) : 0;

  return (
    <>
      <div class="page-header">
        <h1>Storage Audit</h1>
        <p class="subtitle">
          Track every deposit and withdrawal from claim inventories
          {data?.ingesting && (
            <span class="ingesting-badge">
              <span class="spinner-small" /> Syncing logs...
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div class="planner-card">
        <div class="form-row">
          <div class="input-group source-select-container">
            <label for="audit-claim">Claim</label>
            <select
              id="audit-claim"
              class="source-select"
              value={selectedClaim}
              onChange={(e) =>
                setSelectedClaim((e.target as HTMLSelectElement).value)
              }
            >
              {claimsLoading && claims.length === 0 && (
                <option disabled>Loading claims...</option>
              )}
              {claims.map((claim) => (
                <option key={claim.id} value={claim.id}>
                  {claim.name}
                </option>
              ))}
              {!claimsLoading && claims.length === 0 && (
                <option value={ORDUM_MAIN_CLAIM_ID}>Ordum City</option>
              )}
            </select>
          </div>

          <div class="input-group source-select-container">
            <label for="audit-player">Player</label>
            <select
              id="audit-player"
              class="source-select"
              value={selectedPlayer}
              onChange={(e) =>
                setSelectedPlayer((e.target as HTMLSelectElement).value)
              }
            >
              <option value="">All Players</option>
              {(data?.players ?? []).map((p) => (
                <option key={p.entityId} value={p.entityId}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div class="input-group source-select-container">
            <label for="audit-item">Item</label>
            <select
              id="audit-item"
              class="source-select"
              value={selectedItem}
              onChange={(e) =>
                setSelectedItem((e.target as HTMLSelectElement).value)
              }
            >
              <option value="">All Items</option>
              {(data?.items ?? []).map((item) => (
                <option
                  key={`${item.type}:${item.id}`}
                  value={`${item.type}:${item.id}`}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div class="error-banner">
          <span class="error-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* Chart */}
      <div class="planner-card" style="margin-bottom: 16px">
        <h3 style="margin-bottom: 12px; font-size: 14px; color: var(--text-muted)">
          📈 Cumulative Storage Progress
        </h3>
        <StorageChart data={data?.chartData ?? []} />
        {data && data.chartData.length > 0 && (
          <div class="chart-legend">
            <span class="legend-item">
              <span class="legend-swatch" style="background: #6c8cff" />
              Cumulative Net
            </span>
            <span class="legend-item">
              <span
                class="legend-swatch"
                style="background: rgba(74, 222, 128, 0.5)"
              />
              Deposits
            </span>
            <span class="legend-item">
              <span
                class="legend-swatch"
                style="background: rgba(248, 113, 113, 0.5)"
              />
              Withdrawals
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      {loading && !data ? (
        <div class="loading-container">
          <div class="spinner-wrap">
            <div class="spinner" />
            <span class="loading-text">Loading storage audit...</span>
          </div>
        </div>
      ) : data ? (
        <>
          <div class="kpi-row" style="margin-bottom: 12px">
            <div class="kpi-card">
              <div class="kpi-label">Total Events</div>
              <div class="kpi-value text-accent">
                {data.totalCount.toLocaleString()}
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Showing</div>
              <div class="kpi-value text-accent">
                Page {data.page} of {totalPages || 1}
              </div>
            </div>
          </div>

          <div class="table-wrapper">
            <table class="modern-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Inventory</th>
                  <th>Item</th>
                  <th style="text-align: right">Qty</th>
                  <th style="text-align: center">Action</th>
                  <th style="text-align: right">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style="text-align: center; color: var(--text-muted); padding: 24px"
                    >
                      {data.ingesting
                        ? "Logs are still syncing from BitJita — check back shortly"
                        : "No storage events found for this filter combination"}
                    </td>
                  </tr>
                )}
                {data.logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.player_name}</td>
                    <td style="color: var(--text-muted)">{log.building_name}</td>
                    <td>{log.item_name}</td>
                    <td style="text-align: right">
                      {log.quantity.toLocaleString()}
                    </td>
                    <td style="text-align: center">
                      <span
                        class={`action-badge action-${log.action}`}
                      >
                        {log.action === "deposit" ? "▲ Deposit" : "▼ Withdraw"}
                      </span>
                    </td>
                    <td
                      style="text-align: right; color: var(--text-muted); white-space: nowrap"
                    >
                      {formatTimestamp(log.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div class="pagination">
              <button
                class="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage(1)}
              >
                «
              </button>
              <button
                class="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </button>
              <span class="pagination-info">
                Page {page} of {totalPages}
              </span>
              <button
                class="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ›
              </button>
              <button
                class="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                »
              </button>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
