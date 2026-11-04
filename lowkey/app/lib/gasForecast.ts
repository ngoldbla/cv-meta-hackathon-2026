/**
 * Live gas forecasts (task 058). Timestral runs on a scale-to-zero GPU
 * service (cloud/gas_forecast). Searches read its stored forecasts
 * (cached 1 h) merged over the Blob table, and never wait on a GPU:
 * when the ZIP's series is older than the latest EIA week, a refresh
 * is requested in the background. The token stays on the server.
 */
import { after } from "next/server";

import type { GasSeriesEntry } from "./table";

const FETCH_TIMEOUT_MS = 3000;
const REFRESH_EVERY_MS = 10 * 60 * 1000; // per server instance; the service debounces too
let lastRefreshAt = 0;

export function resetGasForecastState(): void {
  lastRefreshAt = 0;
}

export function gasConfig(): { url: string; token: string } | null {
  const url = process.env.LOWKEY_GAS_URL;
  const token = process.env.LOWKEY_GAS_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

const NY_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The most recent Monday whose 18:00 America/New_York has passed. */
export function latestEiaWeek(now: Date): string {
  const p = Object.fromEntries(NY_PARTS.formatToParts(now).map((x) => [x.type, x.value]));
  const dow = WEEKDAYS.indexOf(p.weekday!);
  let back = dow;
  if (dow === 0 && Number(p.hour) < 18) back = 7;
  const d = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) - back));
  return d.toISOString().slice(0, 10);
}

export function isStale(latestDate: string, now: Date = new Date()): boolean {
  return latestDate < latestEiaWeek(now);
}

export function mergeGasSeries(
  base: Record<string, GasSeriesEntry>,
  live: Record<string, GasSeriesEntry> | null,
): Record<string, GasSeriesEntry> {
  if (!live) return base;
  const out = { ...base };
  for (const [duoarea, entry] of Object.entries(live)) {
    const have = out[duoarea];
    if (!have || entry.latestDate > have.latestDate) out[duoarea] = entry;
  }
  return out;
}

export async function fetchLiveGas(): Promise<Record<string, GasSeriesEntry> | null> {
  const cfg = gasConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(`${cfg.url}/gas`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    const body = (await res.json()) as { series?: Record<string, GasSeriesEntry> };
    return body.series ?? null;
  } catch {
    return null;
  }
}

export async function withLiveGas<T extends { gasSeries: Record<string, GasSeriesEntry> }>(table: T): Promise<T> {
  const live = await fetchLiveGas();
  return live ? { ...table, gasSeries: mergeGasSeries(table.gasSeries, live) } : table;
}

function inBackground(task: () => Promise<unknown>): void {
  const run = () => task().catch(() => undefined);
  try {
    after(run);
  } catch {
    void run(); // outside a request (tests, scripts)
  }
}

export function requestRefreshIfStale(latestDate: string | undefined, now: Date = new Date()): void {
  const cfg = gasConfig();
  if (!cfg || !latestDate || !isStale(latestDate, now)) return;
  if (now.getTime() - lastRefreshAt < REFRESH_EVERY_MS) return;
  lastRefreshAt = now.getTime();
  inBackground(() =>
    fetch(`${cfg.url}/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }),
  );
}
