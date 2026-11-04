/**
 * Read the depreciation table back from private Blob storage and
 * validate it (task 037, part 4; run by weekly.sh after upload).
 * Needs BLOB_READ_WRITE_TOKEN in the environment (loaded from
 * ~/.config/low-key/env by weekly.sh; never printed here).
 * Prints one summary line on success; exits non-zero on any failure.
 */
import { get } from "@vercel/blob";

const PATHNAME = "lowkey/table.json";
const MAX_EIA_AGE_DAYS = 8;

function fail(message) {
  console.error(`check_table: ${message}`);
  process.exit(1);
}

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) fail("BLOB_READ_WRITE_TOKEN is not set");

const result = await get(PATHNAME, {
  access: "private",
  useCache: false,
  token,
});
if (!result || result.statusCode !== 200 || !result.stream) {
  fail(`blob read-back failed (status ${result?.statusCode ?? "none"})`);
}
const text = await new Response(result.stream).text();
const bytes = Buffer.byteLength(text);
if (!(bytes > 0)) fail("blob is empty");

let table;
try {
  table = JSON.parse(text);
} catch {
  fail("blob is not valid JSON");
}
if (table.version !== 1) fail(`unexpected version ${table.version}`);

const categories = ["Sedan", "SUV", "Pickup", "Minivan", "Hybrid"].filter(
  (c) => table.lineups?.[c]?.picks?.length > 0,
);
if (categories.length !== 5) {
  fail(`expected 5 categories with picks, found ${categories.length}`);
}

const gasCount = Object.keys(table.gasSeries ?? {}).length;
if (!(gasCount > 0)) fail("no gas series in table");

const taxRows = Object.keys(table.tax?.states ?? {}).length;
if (taxRows !== 51) fail(`expected 51 tax rows, found ${taxRows}`);

const now = Date.now();
const ageDays = (iso) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (now - t) / 86400000 : Infinity;
};
const eiaAsOf = table.sources?.eia?.asOf ?? null;
if (!eiaAsOf) fail("table has no EIA asOf");
let worstAge = ageDays(eiaAsOf);
for (const series of Object.values(table.gasSeries ?? {})) {
  worstAge = Math.max(worstAge, ageDays(series.asOf ?? series.latestDate));
}
if (!(worstAge <= MAX_EIA_AGE_DAYS)) {
  fail(`EIA data is ${worstAge.toFixed(1)} days old (limit ${MAX_EIA_AGE_DAYS})`);
}

console.log(
  `version=${table.version} bytes=${bytes} categories=${categories.length} ` +
    `gasSeries=${gasCount} taxRows=${taxRows} eiaAsOf=${eiaAsOf} ` +
    `eiaMaxAgeDays=${worstAge.toFixed(1)} builtAt=${table.builtAt}`,
);
