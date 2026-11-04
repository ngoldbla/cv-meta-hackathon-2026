/**
 * Fuel estimate (task 027, part 5). Monthly gallons are 1,000 miles
 * (12,000 a year) divided by EPA combined MPG; the price is the
 * Timestral 52-week forecast mean for the ZIP's EIA series (city,
 * then state, then PADD, then US). No MPG or no series means no
 * number at all, never a guess.
 */

export interface FuelForecastMeans {
  meanP10: number;
  meanP50: number;
  meanP90: number;
}

export interface FuelSeriesEntry {
  duoarea: string;
  displayName: string;
  latestDate: string;
  forecast: FuelForecastMeans | null;
}

export interface FuelTable {
  gasSeries: Record<string, FuelSeriesEntry>;
  zipMap: {
    cityZip3: Record<string, number[]>;
    zip3Ranges: [number, number, string][];
    stateSeries: Record<string, string>;
    paddByState: Record<string, string>;
    fallbackDuoarea: string;
  };
}

export function fuelMonthly(mpg: number, pricePerGallon: number): number {
  return (1000 / mpg) * pricePerGallon;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-10-26" -> "week of Oct 26". */
export function weekLabel(dateIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso);
  if (!m) return `week of ${dateIso}`;
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  return `week of ${month} ${Number(m[3])}`;
}

export function seriesForZip(
  zip: string,
  table: FuelTable,
): { duoarea: string; level: "city" | "state" | "padd" | "us" } | null {
  if (!/^\d{5}$/.test(zip)) return null;
  const prefix = Number(zip.slice(0, 3));
  for (const [duoarea, prefixes] of Object.entries(table.zipMap.cityZip3)) {
    if (prefixes.includes(prefix)) return { duoarea, level: "city" };
  }
  let state: string | null = null;
  for (const [lo, hi, st] of table.zipMap.zip3Ranges) {
    if (prefix >= lo && prefix <= hi) {
      state = st;
      break;
    }
  }
  if (state !== null) {
    const stateDuo = table.zipMap.stateSeries[state];
    if (stateDuo) return { duoarea: stateDuo, level: "state" };
    const paddDuo = table.zipMap.paddByState[state];
    if (paddDuo) return { duoarea: paddDuo, level: "padd" };
  }
  return { duoarea: table.zipMap.fallbackDuoarea, level: "us" };
}

export interface FuelEstimate {
  perMonth: number;
  /** EPA combined MPG the estimate used (task 042, part 2b). */
  mpg: number;
  /** "engine"/"drivetrain": matched to the local unit; "typical": the model figure. */
  mpgLevel: "engine" | "drivetrain" | "typical";
  low: number;
  high: number;
  seriesDisplay: string;
  latestDate: string;
  duoarea: string;
  text: string;
}

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function fuelForModel(args: {
  mpg: number | null | undefined;
  zip: string;
  table: FuelTable;
  mpgLevel?: "engine" | "drivetrain" | "typical";
}): FuelEstimate | null {
  const { mpg, zip, table } = args;
  const mpgLevel = args.mpgLevel ?? "typical";
  if (!mpg || !(mpg > 0)) return null;
  const mapped = seriesForZip(zip, table);
  if (!mapped) return null;
  const series = table.gasSeries[mapped.duoarea];
  if (!series?.forecast) return null;
  const perMonth = fuelMonthly(mpg, series.forecast.meanP50);
  const low = fuelMonthly(mpg, series.forecast.meanP10);
  const high = fuelMonthly(mpg, series.forecast.meanP90);
  const text =
    `Gas, est. ${usd0.format(Math.round(perMonth))}/mo ` +
    `(${usd0.format(Math.round(low))}–${usd0.format(Math.round(high))}) · ` +
    `${mpgLevel === "typical" ? "typical MPG" : "EPA combined MPG"} ${mpg} · ` +
    `${series.displayName}, EIA, ${weekLabel(series.latestDate)}`;
  return {
    perMonth,
    mpg,
    mpgLevel,
    low,
    high,
    seriesDisplay: series.displayName,
    latestDate: series.latestDate,
    duoarea: mapped.duoarea,
    text,
  };
}
