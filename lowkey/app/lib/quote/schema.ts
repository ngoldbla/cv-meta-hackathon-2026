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
  /** The amount the sheet says is financed, used as a check on the lines. */
  amountFinanced: money,
  /** A dealer's payment grid: an estimate range per down payment and term. */
  paymentOptions: z
    .array(
      z.object({
        down: z.number().nonnegative().nullable(),
        termMonths: z.number().int().min(6).max(120),
        low: z.number().nonnegative(),
        high: z.number().nonnegative(),
      }),
    )
    .max(24),
  /** True when the price came from a window sticker's total (MSRP), not a selling price. */
  priceIsSticker: z.boolean(),
  fees: z.array(feeSchema).max(30),
  /** Fields read from a photo that the shopper has not yet confirmed. */
  unconfirmed: z.array(z.string()),
  /** Task 057: "terms" when the photo read copied only the money terms (fees then show as one lump). */
  readMode: z.enum(["full", "terms"]).optional(),
  /** Task 057: the car from its VIN lookup; null or absent when typed. */
  car: z
    .object({
      year: z.number().int().nullable(),
      make: z.string().max(60).nullable(),
      model: z.string().max(80).nullable(),
      trim: z.string().max(80).nullable(),
      miles: z.number().int().nonnegative().nullable(),
      status: z.enum(["active", "sold", "missing"]),
    })
    .nullable()
    .optional(),
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
  "amountFinanced",
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
    amountFinanced: null,
    paymentOptions: [],
    priceIsSticker: false,
    fees: [],
    unconfirmed: [],
  };
}

/** What the photo reader returns (snake case, from cloud/quote_reader/normalize.py). */
export const readSchema = z.object({
  doc_type: z.string(),
  /** Task 057: "terms" for the small read (no transcript, no fee lines). */
  mode: z.enum(["full", "terms"]).optional(),
  mileage: z.number().nullable().optional(),
  price_basis: z.enum(["selling", "msrp"]).nullable().optional(),
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
  amount_financed: z.number().nullable().optional(),
  make_from_vin: z.string().nullable().optional(),
  payment_options: z
    .array(
      z.object({
        down: z.number().nullable(),
        term_months: z.number(),
        low: z.number(),
        high: z.number(),
      }),
    )
    .optional(),
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
  const make = q.vin ? (read.make_from_vin ?? null) : null;
  const text = read.vehicle_text?.trim() || null;
  // A sticker often prints the model but carries the make only in its logo.
  q.vehicle =
    (make && text && !text.toLowerCase().includes(make.toLowerCase()) ? `${make} ${text}` : (text ?? make))?.slice(0, 120) ??
    null;
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
  q.amountFinanced = num(read.amount_financed);
  q.paymentOptions = (read.payment_options ?? [])
    .filter((o) => o.term_months >= 6 && o.term_months <= 120 && o.low > 0 && o.high >= o.low)
    .slice(0, 24)
    .map((o) => ({ down: num(o.down), termMonths: Math.round(o.term_months), low: o.low, high: o.high }));
  // A window sticker has no selling price: its total is the sticker price.
  if (read.doc_type === "window_sticker" && q.sellingPrice === null && q.msrp !== null) {
    q.sellingPrice = q.msrp;
    q.priceIsSticker = true;
  }
  if (read.mode === "terms") {
    q.readMode = "terms";
    if (q.sellingPrice === null && q.msrp !== null && read.price_basis === "msrp") {
      q.sellingPrice = q.msrp;
      q.priceIsSticker = true;
    }
    const miles = read.mileage;
    q.mileage =
      typeof miles === "number" && Number.isFinite(miles) && miles >= 0 && miles < 1_000_000 ? Math.round(miles) : null;
  }
  q.fees = (read.fees ?? []).slice(0, 30).map((f) => ({
    label: f.label.slice(0, 120),
    amount: num(f.amount),
    kind: (FEE_KINDS as readonly string[]).includes(f.kind) ? (f.kind as FeeKind) : "unknown",
  }));
  const filled: string[] = [];
  for (const k of MONEY_FIELDS) if (q[k] !== null) filled.push(k);
  if (q.vin) filled.push("vin");
  if (q.mileage !== null) filled.push("mileage");
  if (q.fees.length) filled.push("fees");
  if (q.paymentOptions.length) filled.push("paymentOptions");
  q.unconfirmed = filled;
  return q;
}
