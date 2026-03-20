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
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from "lightweight-charts";
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

// ─── Chart Component (TradingView Lightweight Charts) ───────────────────────────

/** Aggregate hourly candles into daily when there are many data points. */
function aggregateToDaily(
  data: StorageAuditChartPoint[],
): StorageAuditChartPoint[] {
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
  return aggregated;
}

/** Convert a bucket string like "2026-03-15" or "2026-03-15T14" to a unix timestamp. */
function bucketToTime(bucket: string): Time {
  // Daily: "2026-03-15" → use as string date
  if (bucket.length === 10) return bucket as unknown as Time;
  // Hourly: "2026-03-15T14" → unix timestamp
  return (Date.parse(bucket + ":00:00Z") / 1000) as unknown as Time;
}

function StorageChart({ data: data }: { data: StorageAuditChartPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Create or update chart when data changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Lazy-create chart on first data arrival
    if (!chartRef.current) {
      const chart = createChart(container, {
        autoSize: true,
        layout: {
          background: { color: "transparent" },
          textColor: "#7c8495",
          fontFamily: "Inter, sans-serif",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        crosshair: {
          mode: 0, // Normal
          vertLine: { labelVisible: false },
        },
        rightPriceScale: {
          borderColor: "rgba(255,255,255,0.08)",
        },
        timeScale: {
          borderColor: "rgba(255,255,255,0.08)",
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#4ade80",
        downColor: "#f87171",
        borderUpColor: "#4ade80",
        borderDownColor: "#f87171",
        wickUpColor: "#4ade80",
        wickDownColor: "#f87171",
        priceScaleId: "right",
      });

      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      // Tooltip on crosshair move
      chart.subscribeCrosshairMove((param) => {
        const tooltip = tooltipRef.current;
        if (!tooltip) return;

        if (
          !param.time ||
          !param.point ||
          param.point.x < 0 ||
          param.point.y < 0
        ) {
          tooltip.style.display = "none";
          return;
        }

        const candleData = param.seriesData.get(candleSeries) as
          | CandlestickData
          | undefined;
        const volData = param.seriesData.get(volSeries) as
          | HistogramData
          | undefined;

        if (!candleData) {
          tooltip.style.display = "none";
          return;
        }

        const net = (candleData.close ?? 0) - (candleData.open ?? 0);
        const netColor = net >= 0 ? "#4ade80" : "#f87171";
        const netSign = net >= 0 ? "+" : "";
        const vol = volData?.value ?? 0;

        tooltip.innerHTML = `
          <div style="font-weight:600;margin-bottom:4px">${String(candleData.time)}</div>
          <div>Open: <b>${Math.round(candleData.open).toLocaleString()}</b></div>
          <div>Close: <b>${Math.round(candleData.close).toLocaleString()}</b></div>
          <div>Net: <b style="color:${netColor}">${netSign}${Math.round(net).toLocaleString()}</b></div>
          <div>Volume: <b>${Math.round(vol).toLocaleString()}</b></div>
        `;
        tooltip.style.display = "block";

        const chartRect = container.getBoundingClientRect();
        let left = param.point.x + 16;
        if (left + 160 > chartRect.width) left = param.point.x - 170;
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${Math.max(0, param.point.y - 40)}px`;
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volSeriesRef.current = volSeries;
    }

    // Update data
    const chart = chartRef.current!;
    const candleSeries = candleSeriesRef.current!;
    const volSeries = volSeriesRef.current!;

    if (data.length === 0) return;

    const candleData: CandlestickData[] = data.map((d) => ({
      time: bucketToTime(d.bucket ?? ""),
      open: d.cumOpen,
      high: Math.max(d.cumOpen, d.cumClose),
      low: Math.min(d.cumOpen, d.cumClose),
      close: d.cumClose,
    }));

    const volData: HistogramData[] = data.map((d) => ({
      time: bucketToTime(d.bucket ?? ""),
      value: d.deposits + d.withdrawals,
      color:
        d.cumClose >= d.cumOpen
          ? "rgba(74, 222, 128, 0.4)"
          : "rgba(248, 113, 113, 0.4)",
    }));

    candleSeries.setData(candleData);
    volSeries.setData(volData);
    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volSeriesRef.current = null;
    };
  }, [data]);

  return (
    <div style="position: relative">
      <div ref={containerRef} style="width: 100%; height: 350px" />
      <div ref={tooltipRef} class="chart-tooltip" style="display: none" />
    </div>
  );
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

          <div
            class="input-group source-select-container"
            style="flex: 0 0 auto; align-self: flex-end"
          >
            <button
              class="sync-btn"
              disabled={syncing}
              onClick={() => triggerSync()}
            >
              {syncing ? (
                <>
                  <span class="spinner-small" /> Syncing...
                </>
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
        <StorageChart data={data?.chartData ?? []} />
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
                      No storage events found — try clicking "Sync Now" to fetch
                      logs from BitJita
                    </td>
                  </tr>
                )}
                {data.logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.player_name}</td>
                    <td style="color: var(--text-muted)">
                      {log.building_name}
                    </td>
                    <td>{log.item_name}</td>
                    <td style="text-align: right">
                      {log.quantity.toLocaleString()}
                    </td>
                    <td style="text-align: center">
                      <span class={`action-badge action-${log.action}`}>
                        {log.action === "deposit" ? "▲ Deposit" : "▼ Withdraw"}
                      </span>
                    </td>
                    <td style="text-align: right; color: var(--text-muted); white-space: nowrap">
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
