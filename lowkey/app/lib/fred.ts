/**
 * Federal Reserve loan rate (task 026, part 3).
 *
 * Default APR is the latest non-empty value of FRED series
 * RIFLPBCIANM60NM (finance rate on 60-month new-car loans at
 * commercial banks). Fetched server-side with a one-day cache.
 * Falls back to 8.0% labelled "assumed" when the fetch fails.
 */

export const FRED_CSV_URL =
  "https://fred.stlouisfed.org/graph/fredgraph.csv?id=RIFLPBCIANM60NM";
export const FRED_SERIES = "RIFLPBCIANM60NM";
export const FALLBACK_APR_PERCENT = 8;

export interface FredApr {
  aprPercent: number;
  /** ISO date of the observation, e.g. "2026-08-01"; null on fallback. */
  dateIso: string | null;
  assumed: boolean;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Latest non-empty observation in FRED CSV text, or null. */
export function parseFredCsv(csvText: string): FredApr | null {
  const lines = csvText.split(/\r?\n/);
  let best: FredApr | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(",");
    if (parts.length < 2) continue;
    const date = (parts[0] ?? "").trim();
    const raw = (parts[1] ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!raw || raw === ".") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) continue;
    best = { aprPercent: value, dateIso: date, assumed: false };
  }
  return best;
}

export function monthYearLabel(dateIso: string): string {
  const m = /^(\d{4})-(\d{2})-/.exec(dateIso);
  if (!m) return dateIso;
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  return `${month} ${m[1]}`;
}

/** "7.54" from 7.54; "8.0" from 8. */
export function formatAprPercent(aprPercent: number): string {
  return aprPercent.toFixed(2).replace(/0$/, "");
}

/**
 * On-screen rate line, e.g.
 * "7.54% APR: the national average for 60-month new-car loans (Federal Reserve, Aug 2026)".
 */
export function aprLabel(info: FredApr): string {
  if (info.assumed || !info.dateIso) {
    return `${formatAprPercent(info.aprPercent)}% APR (assumed)`;
  }
  return `${formatAprPercent(info.aprPercent)}% APR: the national average for 60-month new-car loans (Federal Reserve, ${monthYearLabel(info.dateIso)})`;
}

/**
 * User-stated rate override, e.g. "My rate is 5.9%" or "5.9% APR".
 * Returns null when the text states no rate.
 */
export function parseUserApr(text: string): number | null {
  const patterns = [
    /my rate is\s*(\d+(?:\.\d+)?)\s*%/i,
    /rate is\s*(\d+(?:\.\d+)?)\s*%/i,
    /(\d+(?:\.\d+)?)\s*%\s*APR/i,
    /APR\s*(?:is\s*)?(\d+(?:\.\d+)?)\s*%/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const v = Number(m[1]);
      if (Number.isFinite(v) && v >= 0 && v < 40) return v;
    }
  }
  return null;
}

export const FALLBACK_APR: FredApr = {
  aprPercent: FALLBACK_APR_PERCENT,
  dateIso: null,
  assumed: true,
};

type Fetcher = (
  url: string,
  init?: { next?: { revalidate: number }; cache?: string },
) => Promise<{ ok: boolean; text: () => Promise<string> }>;

/**
 * Fetch the default APR server-side with a one-day cache
 * (Next.js fetch revalidate: 86400). Never throws: any failure
 * returns the 8.0% assumed fallback.
 */
export async function getDefaultApr(fetcher: Fetcher = fetch as Fetcher): Promise<FredApr> {
  try {
    const res = await fetcher(FRED_CSV_URL, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return { ...FALLBACK_APR };
    const text = await res.text();
    const parsed = parseFredCsv(text);
    if (!parsed) return { ...FALLBACK_APR };
    return parsed;
  } catch {
    return { ...FALLBACK_APR };
  }
}
