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
import { useEffect, useMemo, useRef } from "preact/hooks";
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
  $auditClaims,
  $auditPlayers,
  $auditItems,
  $auditDateFrom,
  $auditDateTo,
  $auditPage,
  $auditView,
} from "../stores/storageAudit";
import { MultiSelect } from "../components/MultiSelect";
import { ORDUM_MAIN_CLAIM_ID } from "../../common/ordum-types";
import type { StorageAuditChartPoint } from "../../server/storage-audit";

/** Convert a bucket string like "2026-03-15" or "2026-03-15T14" to a unix timestamp. */
function bucketToTime(bucket: string): Time {
  switch (bucket.length) {
    // Daily: "2026-03-15" → use as string date
    case "2026-03-15".length:
      return bucket as unknown as Time;
    // Hourly: "2026-03-15T14" → unix timestamp
    case "2026-03-15T14".length:
      return (Date.parse(bucket + ":00:00Z") / 1000) as unknown as Time;
    default:
      return Math.trunc(Date.parse(bucket) / 1000) as unknown as Time;
  }
}

function formatTime(time: Time): string {
  if (typeof time === "string") return time; // "YYYY-MM-DD" daily bucket
  // Unix timestamp (seconds) → readable date+hour
  const d = new Date((time as number) * 1000);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
          fixLeftEdge: true,
          fixRightEdge: true,
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
        priceFormat: { type: "price", precision: 0, minMove: 1 },
      });

      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume", precision: 0 },
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
          <div style="font-weight:600;margin-bottom:4px">${formatTime(candleData.time)}</div>
          <div>Open: <b>${Math.round(candleData.open).toLocaleString()} ¢</b></div>
          <div>Close: <b>${Math.round(candleData.close).toLocaleString()} ¢</b></div>
          <div>Net: <b style="color:${netColor}">${netSign}${Math.round(net).toLocaleString()} ¢</b></div>
          <div>Volume: <b>${Math.round(vol).toLocaleString()} ¢</b></div>
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
  const selectedClaims = useStore($auditClaims);
  const selectedPlayers = useStore($auditPlayers);
  const selectedItems = useStore($auditItems);
  const dateFrom = useStore($auditDateFrom);
  const dateTo = useStore($auditDateTo);
  const { dataAsync, page, totalPages } = useStore($auditView);

  useEffect(() => {
    fetchEmpireClaims();
  }, []);

  const claimNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of claims) m.set(c.id, c.name);
    return m;
  }, [claims]);

  const loading = dataAsync.state === "loading";
  const error = dataAsync.state === "failed" ? String(dataAsync.error) : null;
  const data = dataAsync.state === "ready" ? dataAsync.value : null;

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
          <MultiSelect
            label="Claim"
            placeholder={claimsLoading && claims.length === 0 ? "Loading claims..." : "All Claims"}
            options={
              claims.length > 0
                ? claims.map((claim) => ({
                    value: claim.id,
                    label: claim.name,
                  }))
                : [{ value: ORDUM_MAIN_CLAIM_ID, label: "Ordum City" }]
            }
            selected={selectedClaims}
            onChange={(v) => $auditClaims.set(v)}
          />

          <div class="input-group">
            <label for="audit-date-from">From</label>
            <input
              id="audit-date-from"
              type="date"
              class="source-select"
              value={dateFrom}
              onChange={(e) =>
                $auditDateFrom.set((e.target as HTMLInputElement).value)
              }
            />
          </div>

          <div class="input-group">
            <label for="audit-date-to">To</label>
            <input
              id="audit-date-to"
              type="date"
              class="source-select"
              value={dateTo}
              onChange={(e) =>
                $auditDateTo.set((e.target as HTMLInputElement).value)
              }
            />
          </div>

          <MultiSelect
            label="Player"
            placeholder="All Players"
            options={(data?.players ?? []).map((p) => ({
              value: p.entityId,
              label: p.name,
            }))}
            selected={selectedPlayers}
            onChange={(v) => $auditPlayers.set(v)}
          />

          <MultiSelect
            label="Item"
            placeholder="All Items"
            options={(data?.items ?? []).map((item) => ({
              value: `${item.type}:${item.id}`,
              label: item.name,
            }))}
            selected={selectedItems}
            onChange={(v) => $auditItems.set(v)}
          />
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
          <div class="table-wrapper">
            <table class="modern-table">
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Player</th>
                  <th>Inventory</th>
                  <th>Item</th>
                  <th style="text-align: right">Qty</th>
                  <th style="text-align: right">Value</th>
                  <th style="text-align: center">Action</th>
                  <th style="text-align: right">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      style="text-align: center; color: var(--text-muted); padding: 24px"
                    >
                      No storage events found.
                    </td>
                  </tr>
                )}
                {data.logs.map((log) => (
                  <tr key={log.id}>
                    <td style="color: var(--text-muted)">
                      {claimNameMap.get(log.claim_id) ?? log.claim_id}
                    </td>
                    <td>{log.player_name}</td>
                    <td style="color: var(--text-muted)">
                      {log.building_name}
                    </td>
                    <td>{log.item_name}</td>
                    <td style="text-align: right">
                      {log.quantity.toLocaleString()}
                    </td>
                    <td style="text-align: right; color: var(--text-muted)">
                      {log.unit_value > 0
                        ? `${Math.round(log.quantity * log.unit_value).toLocaleString()} ¢`
                        : "—"}
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
