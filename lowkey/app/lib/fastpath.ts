/**
 * Fast-path detection (task 026, part 5).
 *
 * When the first message contains a ZIP and a category, the server
 * calls rank_category, ownership_math and local_units directly
 * instead of waiting for the model. Follow-ups still use the model.
 */

import type { Category } from "./table";
import { parseUserApr } from "./fred";

export interface FastRequest {
  zip: string;
  category: Category;
  /** User-stated APR ("My rate is 5.9%"), or null for the default. */
  userApr: number | null;
  /** Fixed-dollar down payment, or null for the 10% default. */
  downFixed: number | null;
  /** Percent down payment (0–100), or null. */
  downPercent: number | null;
}

export function parseZip(text: string): string | null {
  const m = /\b(\d{5})(?:-\d{4})?\b/.exec(text);
  return m ? m[1] : null;
}

export function parseCategory(text: string): Category | null {
  if (/\bsuvs?\b/i.test(text)) return "SUV";
  if (/\bsedans?\b/i.test(text)) return "Sedan";
  if (/\bpickups?\b/i.test(text) || /\btrucks?\b/i.test(text)) return "Pickup";
  return null;
}

/** "$5k down" / "$5,000 down" / "10% down", or null. */
export function parseDown(
  text: string,
): { fixed: number | null; percent: number | null } {
  const pct = /(\d+(?:\.\d+)?)\s*%\s*down/i.exec(text);
  if (pct) return { fixed: null, percent: Number(pct[1]) };
  const k = /\$\s*(\d+(?:\.\d+)?)\s*k\s+down/i.exec(text);
  if (k) return { fixed: Math.round(Number(k[1]) * 1000), percent: null };
  const plain = /\$\s*([\d,]+(?:\.\d+)?)\s*down/i.exec(text);
  if (plain) return { fixed: Number(plain[1].replace(/,/g, "")), percent: null };
  const bare = /\b([\d,]{3,})\s+down\b/i.exec(text);
  if (bare) return { fixed: Number(bare[1].replace(/,/g, "")), percent: null };
  return { fixed: null, percent: null };
}

/** Parse a first-message fast request, or null to use the model. */
export function parseFastRequest(text: string): FastRequest | null {
  const zip = parseZip(text);
  const category = parseCategory(text);
  if (!zip || !category) return null;
  const down = parseDown(text);
  return {
    zip,
    category,
    userApr: parseUserApr(text),
    downFixed: down.fixed,
    downPercent: down.percent,
  };
}

/** Down-payment dollars for a pick price under a fast request. */
export function downForPrice(req: FastRequest, price: number): number {
  if (req.downFixed !== null) return req.downFixed;
  if (req.downPercent !== null) return (price * req.downPercent) / 100;
  return price * 0.1;
}
