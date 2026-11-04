/**
 * The Quote schema (tasks 046 and 047): one source of truth for a
 * dealer quote, whether the shopper typed it or the photo reader
 * filled it. Every money field is a number in dollars or null when
 * the document doesn't say. A field read from a photo counts only
 * after the shopper confirms it (`confirmed`), so a misread can never
 * reach the compare maths unseen.
 */

import { z } from "zod";

export const FEE_KINDS = ["government", "dealer", "addon", "unknown"] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

export const feeSchema = z.object({
  label: z.string().max(120),
  amount: z.number().nonnegative().nullable(),
  kind: z.enum(FEE_KINDS),
});
export type Fee = z.infer<typeof feeSchema>;

const money = z.number().nonnegative().max(1_000_000).nullable();

export const quoteSchema = z.object({
  source: z.enum(["manual", "photo"]),
  vin: z.string().max(17).nullable(),
  year: z.number().int().min(1980).max(2100).nullable(),
  vehicle: z.string().max(120).nullable(),
  dealerName: z.string().max(120).nullable(),
  used: z.boolean().nullable(),
  mileage: z.number().int().nonnegative().nullable(),
  sellingPrice: money,
  msrp: money,
  rebates: money,
  tradeIn: money,
  down: money,
  outTheDoor: money,
  statedMonthly: money,
  apr: z.number().min(0).max(40).nullable(),
  termMonths: z.number().int().min(6).max(120).nullable(),
  fees: z.array(feeSchema).max(30),
  /** Fields read from a photo that the shopper has not yet confirmed. */
  unconfirmed: z.array(z.string()),
});
export type Quote = z.infer<typeof quoteSchema>;

/** The money and loan fields the compare maths reads. */
export const MONEY_FIELDS = [
  "sellingPrice",
  "msrp",
  "rebates",
  "tradeIn",
  "down",
  "outTheDoor",
  "statedMonthly",
  "apr",
  "termMonths",
] as const;
export type MoneyField = (typeof MONEY_FIELDS)[number];

export function emptyQuote(): Quote {
  return {
    source: "manual",
    vin: null,
    year: null,
    vehicle: null,
    dealerName: null,
    used: null,
    mileage: null,
    sellingPrice: null,
    msrp: null,
    rebates: null,
    tradeIn: null,
    down: null,
    outTheDoor: null,
    statedMonthly: null,
    apr: null,
    termMonths: null,
    fees: [],
    unconfirmed: [],
  };
}

/** What the photo reader returns (snake case, from cloud/quote_reader/normalize.py). */
export const readSchema = z.object({
  doc_type: z.string(),
  vin: z.string().nullable().optional(),
  vin_check_ok: z.boolean().optional(),
  year: z.number().nullable().optional(),
  vehicle_text: z.string().nullable().optional(),
  selling_price: z.number().nullable().optional(),
  msrp: z.number().nullable().optional(),
  down: z.number().nullable().optional(),
  out_the_door: z.number().nullable().optional(),
  stated_monthly: z.number().nullable().optional(),
  rebates: z.number().nullable().optional(),
  trade_in: z.number().nullable().optional(),
  apr: z.number().nullable().optional(),
  term_months: z.number().nullable().optional(),
  fees: z
    .array(
      z.object({
        label: z.string(),
        amount: z.number().nullable(),
        kind: z.string(),
      }),
    )
    .optional(),
});
export type ReadResult = z.infer<typeof readSchema>;

const VIN_TRANS: Record<string, number> = Object.fromEntries(
  "ABCDEFGHJKLMNPRSTUVWXYZ"
    .split("")
    .map((c, i) => [c, [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 7, 9, 2, 3, 4, 5, 6, 7, 8, 9][i]]),
);
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/** True when a VIN is 17 legal characters and its check digit holds. */
export function vinCheckOk(vin: string): boolean {
  const v = vin.trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return false;
  let total = 0;
  for (let i = 0; i < 17; i += 1) {
    const c = v[i];
    const n = /\d/.test(c) ? Number(c) : VIN_TRANS[c];
    if (n === undefined) return false;
    total += n * VIN_WEIGHTS[i];
  }
  const check = total % 11 === 10 ? "X" : String(total % 11);
  return v[8] === check;
}

function num(x: number | null | undefined): number | null {
  return typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : null;
}

/**
 * A reader result as a Quote. Every field the reader filled is marked
 * unconfirmed; a VIN that fails its check digit is dropped (shown as
 * unread), never "fixed".
 */
export function quoteFromRead(read: ReadResult): Quote {
  const q = emptyQuote();
  q.source = "photo";
  const vin = read.vin?.trim().toUpperCase() ?? null;
  q.vin = vin && vinCheckOk(vin) ? vin : null;
  q.year = read.year && read.year >= 1980 && read.year <= 2100 ? Math.round(read.year) : null;
  q.vehicle = read.vehicle_text?.slice(0, 120) ?? null;
  q.sellingPrice = num(read.selling_price);
  q.msrp = num(read.msrp);
  q.down = num(read.down);
  q.outTheDoor = num(read.out_the_door);
  q.statedMonthly = num(read.stated_monthly);
  q.rebates = num(read.rebates);
  q.tradeIn = num(read.trade_in);
  q.apr = typeof read.apr === "number" && read.apr >= 0 && read.apr <= 40 ? read.apr : null;
  q.termMonths =
    typeof read.term_months === "number" && read.term_months >= 6 && read.term_months <= 120
      ? Math.round(read.term_months)
      : null;
  q.fees = (read.fees ?? []).slice(0, 30).map((f) => ({
    label: f.label.slice(0, 120),
    amount: num(f.amount),
    kind: (FEE_KINDS as readonly string[]).includes(f.kind) ? (f.kind as FeeKind) : "unknown",
  }));
  const filled: string[] = [];
  for (const k of MONEY_FIELDS) if (q[k] !== null) filled.push(k);
  if (q.vin) filled.push("vin");
  if (q.fees.length) filled.push("fees");
  q.unconfirmed = filled;
  return q;
}
