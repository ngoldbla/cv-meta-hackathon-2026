/**
 * Task 059: a deal as a link. The confirmed quote is packed after the
 * `#`, so it never reaches the server, a log or analytics. It holds the
 * car, VIN, dealer and money fields; the schema has no name or phone.
 */

import { quoteSchema, vinCheckOk, type Quote } from "./schema";

export const MAX_PAYLOAD = 4096;
const VERSION = 1;

function toB64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): string {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** The payload for a deal, or null when it would be too long for a link. */
export function encodeDeal(q: Quote): string | null {
  const rest: Partial<Quote> = { ...q };
  delete rest.unconfirmed;
  delete rest.source;
  const payload = toB64url(JSON.stringify({ v: VERSION, q: rest }));
  return payload.length <= MAX_PAYLOAD ? payload : null;
}

export function shareUrl(origin: string, q: Quote): string | null {
  const payload = encodeDeal(q);
  return payload ? `${origin}/quote#d=${payload}` : null;
}

/** The deal in a `#d=…` fragment, or null when it is missing, damaged, oversize or invalid. */
export function decodeDeal(hash: string): Quote | null {
  const m = /^#?d=([A-Za-z0-9_-]*)$/.exec(hash);
  if (!m || !m[1] || m[1].length > MAX_PAYLOAD) return null;
  try {
    const body = JSON.parse(fromB64url(m[1])) as { v?: unknown; q?: unknown };
    if (body.v !== VERSION || typeof body.q !== "object" || body.q === null) return null;
    const parsed = quoteSchema.safeParse({ ...body.q, source: "manual", unconfirmed: [] });
    if (!parsed.success) return null;
    if (parsed.data.vin !== null && !vinCheckOk(parsed.data.vin)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
