/**
 * Fast-path detection (task 026, part 5; task 030, part 3).
 *
 * When a user message, together with the conversation so far,
 * gives a ZIP and a category, the server calls rank_category,
 * ownership_math and local_units directly instead of waiting for
 * the model. Task 026 covered the first message; task 030 extends
 * it to any user turn whose own text gives a ZIP or a category.
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

/**
 * Fast request from the whole conversation (task 030, part 3).
 * `texts` are the user messages oldest-first. The latest ZIP and
 * the latest category win; APR and down-payment overrides are kept
 * the same way. The fast path runs only when the newest message
 * itself gives a ZIP or a category — a down-payment-only follow-up
 * ("What if I put $5k down?") still goes to the model — and only
 * once both a ZIP and a category are known from somewhere.
 */
export function parseConversationFastRequest(
  texts: string[],
): FastRequest | null {
  if (texts.length === 0) return null;
  const newest = texts[texts.length - 1] ?? "";
  if (!parseZip(newest) && !parseCategory(newest)) return null;
  let zip: string | null = null;
  let category: Category | null = null;
  let userApr: number | null = null;
  let downFixed: number | null = null;
  let downPercent: number | null = null;
  for (const text of texts) {
    const z = parseZip(text);
    if (z) zip = z;
    const c = parseCategory(text);
    if (c) category = c;
    const apr = parseUserApr(text);
    if (apr !== null) userApr = apr;
    const down = parseDown(text);
    if (down.fixed !== null || down.percent !== null) {
      downFixed = down.fixed;
      downPercent = down.percent;
    }
  }
  if (!zip || !category) return null;
  return { zip, category, userApr, downFixed, downPercent };
}

/** Down-payment dollars for a pick price under a fast request. */
export function downForPrice(req: FastRequest, price: number): number {
  if (req.downFixed !== null) return req.downFixed;
  if (req.downPercent !== null) return (price * req.downPercent) / 100;
  return price * 0.1;
}
