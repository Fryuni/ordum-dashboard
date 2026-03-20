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
import { useEffect, useRef } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import {
  $empireClaims,
  $empireClaimsLoading,
  fetchEmpireClaims,
} from "../stores/craftSource";
import {
  $auditClaim,
  $auditPlayer,
  $auditItem,
  $auditPage,
  $auditView,
  triggerSync,
} from "../stores/storageAudit";
import { ORDUM_MAIN_CLAIM_ID } from "../../common/ordum-types";
import type { StorageAuditChartPoint } from "../../server/storage-audit";

// ─── Candlestick + Volume Chart (pure canvas) ──────────────────────────────────

/**
 * Candlestick chart: each hourly bucket is a candle whose body spans
 * cumOpen → cumClose.  Green candle = net positive (close ≥ open),
 * red candle = net negative.  Below the candles a volume sub-chart shows
 * deposit (green) and withdrawal (red) bars side-by-side.
 */
/**
 * Aggregate hourly candles into daily candles when there are too many
 * data points to render clearly.
 */
function aggregateCandles(
  data: StorageAuditChartPoint[],
  maxCandles: number,
): { points: StorageAuditChartPoint[]; daily: boolean } {
  if (data.length <= maxCandles) return { points: data, daily: false };

  // Group by day
  const groups = new Map<string, StorageAuditChartPoint[]>();
  for (const d of data) {
    const day = d.bucket?.slice(0, 10) ?? "unknown";
    const arr = groups.get(day);
    if (arr) arr.push(d);
    else groups.set(day, [d]);
  }

  const aggregated: StorageAuditChartPoint[] = [];
  for (const [day, points] of groups) {
    const first = points[0]!;
    const last = points[points.length - 1]!;
    aggregated.push({
      bucket: day,
      deposits: points.reduce((s, p) => s + p.deposits, 0),
      withdrawals: points.reduce((s, p) => s + p.withdrawals, 0),
      net: points.reduce((s, p) => s + p.net, 0),
      cumOpen: first.cumOpen,
      cumClose: last.cumClose,
    });
  }

  return { points: aggregated, daily: true };
}

function StorageChart({ data: rawData }: { data: StorageAuditChartPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rawData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 20, right: 16, bottom: 36, left: 60 };
    const plotW = w - pad.left - pad.right;
    const totalPlotH = h - pad.top - pad.bottom;

    // Aggregate to daily if there are too many hourly candles
    // Aim for candles at least 6px wide
    const maxCandles = Math.floor(plotW / 6);
    const { points: data, daily } = aggregateCandles(rawData, maxCandles);
    // 70% for candles, 30% for volume, with a small gap
    const candleH = totalPlotH * 0.65;
    const volGap = totalPlotH * 0.05;
    const volH = totalPlotH * 0.3;
    const volTop = pad.top + candleH + volGap;

    ctx.clearRect(0, 0, w, h);

    const n = data.length;
    const gap = plotW / n;
    const candleW = Math.max(1, gap * 0.6);

    // ── Candle Y-axis ────────────────────────────────────────────────────
    const allVals = data.flatMap((d) => [d.cumOpen, d.cumClose]);
    let minVal = Math.min(...allVals);
    let maxVal = Math.max(...allVals);
    if (minVal === maxVal) {
      minVal -= 1;
      maxVal += 1;
    }
    const valRange = maxVal - minVal;
    const valPad = valRange * 0.08;
    const yMin = minVal - valPad;
    const yMax = maxVal + valPad;
    const yScale = candleH / (yMax - yMin);
    const toY = (v: number) => pad.top + (yMax - v) * yScale;

    // ── Volume Y-axis ────────────────────────────────────────────────────
    const maxVol = Math.max(...data.map((d) => Math.max(d.deposits, d.withdrawals)), 1);
    const volScale = volH / maxVol;

    // ── Grid lines (candle area) ─────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const y = pad.top + (candleH / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      const val = yMax - ((yMax - yMin) / gridSteps) * i;
      ctx.fillStyle = "#7c8495";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(formatCompact(val), pad.left - 8, y + 4);
    }

    // Separator line between candle and volume areas
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(pad.left, volTop - volGap / 2);
    ctx.lineTo(w - pad.right, volTop - volGap / 2);
    ctx.stroke();

    // ── Candles ──────────────────────────────────────────────────────────
    const GREEN = "#4ade80";
    const RED = "#f87171";
    const GREEN_DIM = "rgba(74, 222, 128, 0.25)";
    const RED_DIM = "rgba(248, 113, 113, 0.25)";

    for (let i = 0; i < n; i++) {
      const d = data[i]!;
      const cx = pad.left + gap * i + gap / 2;
      const bullish = d.cumClose >= d.cumOpen;
      const color = bullish ? GREEN : RED;
      const dimColor = bullish ? GREEN_DIM : RED_DIM;

      const bodyTop = toY(Math.max(d.cumOpen, d.cumClose));
      const bodyBot = toY(Math.min(d.cumOpen, d.cumClose));
      const bodyH = Math.max(1, bodyBot - bodyTop);

      // Body (no wick — we only have open/close, not high/low)
      ctx.fillStyle = dimColor;
      ctx.fillRect(cx - candleW / 2, bodyTop, candleW, bodyH);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - candleW / 2, bodyTop, candleW, bodyH);
    }

    // ── Volume bars (deposit + withdrawal side by side) ────────────────
    const halfBar = Math.max(1, candleW * 0.45);
    for (let i = 0; i < n; i++) {
      const d = data[i]!;
      const cx = pad.left + gap * i + gap / 2;
      const volBase = volTop + volH;

      if (d.deposits > 0) {
        const bh = d.deposits * volScale;
        ctx.fillStyle = "rgba(74, 222, 128, 0.45)";
        ctx.fillRect(cx - halfBar, volBase - bh, halfBar, bh);
      }
      if (d.withdrawals > 0) {
        const bh = d.withdrawals * volScale;
        ctx.fillStyle = "rgba(248, 113, 113, 0.45)";
        ctx.fillRect(cx, volBase - bh, halfBar, bh);
      }
    }

    // ── X-axis labels ────────────────────────────────────────────────────
    ctx.fillStyle = "#7c8495";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    const labelWidth = daily ? 50 : 80;
    const maxLabels = Math.floor(plotW / labelWidth);
    const labelStep = Math.max(1, Math.ceil(n / maxLabels));
    for (let i = 0; i < n; i += labelStep) {
      const d = data[i]!;
      const x = pad.left + gap * i + gap / 2;
      const bucket = d.bucket ?? "";
      let label: string;
      if (daily) {
        label = bucket.slice(5); // MM-DD
      } else {
        const parts = bucket.split("T");
        label = `${(parts[0] ?? "").slice(5)} ${(parts[1] ?? "00")}h`;
      }
      ctx.fillText(label, x, h - pad.bottom + 14);
    }

    // ── Zero line ────────────────────────────────────────────────────────
    if (yMin < 0 && yMax > 0) {
      const zeroY = toY(0);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, zeroY);
      ctx.lineTo(w - pad.right, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [rawData]);

  if (rawData.length === 0) {
    return (
      <div class="chart-empty">
        <span class="text-muted">No data to chart yet</span>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style="width: 100%; height: 320px; display: block"
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

export default function StorageAuditPage() {
  const claims = useStore($empireClaims);
  const claimsLoading = useStore($empireClaimsLoading);
  const selectedClaim = useStore($auditClaim);
  const selectedPlayer = useStore($auditPlayer);
  const selectedItem = useStore($auditItem);
  const { dataAsync, page, totalPages, syncing } = useStore($auditView);

  useEffect(() => {
    fetchEmpireClaims();
  }, []);

  const loading = dataAsync.state === "loading";
  const error = dataAsync.state === "failed" ? String(dataAsync.error) : null;
  const data = dataAsync.state === "loaded" ? dataAsync.value : null;

  return (
    <div>
      <div class="page-header">
        <h1>Storage Audit</h1>
        <p class="subtitle">
          Track every deposit and withdrawal from claim inventories
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
                $auditClaim.set((e.target as HTMLSelectElement).value)
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
                $auditPlayer.set((e.target as HTMLSelectElement).value)
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
                $auditItem.set((e.target as HTMLSelectElement).value)
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

          <div class="input-group source-select-container" style="flex: 0 0 auto; align-self: flex-end">
            <button
              class="sync-btn"
              disabled={syncing}
              onClick={() => triggerSync()}
            >
              {syncing ? (
                <><span class="spinner-small" /> Syncing...</>
              ) : (
                <>🔄 Sync Now</>
              )}
            </button>
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
          📈 Storage Progress (hourly)
        </h3>
        <StorageChart data={data?.chartData ?? []} />
        {data && data.chartData.length > 0 && (
          <div class="chart-legend">
            <span class="legend-item">
              <span class="legend-swatch" style="background: rgba(74, 222, 128, 0.25); border: 1px solid #4ade80" />
              Net positive
            </span>
            <span class="legend-item">
              <span class="legend-swatch" style="background: rgba(248, 113, 113, 0.25); border: 1px solid #f87171" />
              Net negative
            </span>
            <span class="legend-item">
              <span class="legend-swatch" style="background: rgba(74, 222, 128, 0.45)" />
              Deposits
            </span>
            <span class="legend-item">
              <span class="legend-swatch" style="background: rgba(248, 113, 113, 0.45)" />
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
                      No storage events found — try clicking "Sync Now" to fetch logs from BitJita
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
                onClick={() => $auditPage.set(1)}
              >
                «
              </button>
              <button
                class="pagination-btn"
                disabled={page <= 1}
                onClick={() => $auditPage.set(Math.max(1, page - 1))}
              >
                ‹
              </button>
              <span class="pagination-info">
                Page {page} of {totalPages}
              </span>
              <button
                class="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => $auditPage.set(Math.min(totalPages, page + 1))}
              >
                ›
              </button>
              <button
                class="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => $auditPage.set(totalPages)}
              >
                »
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
