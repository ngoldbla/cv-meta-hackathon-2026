// @vitest-environment node
import { describe, expect, it } from "vitest";

import { emptyQuote, type Quote } from "./schema";
import { decodeDeal, encodeDeal, MAX_PAYLOAD, shareUrl } from "./shareLink";

const VIN = "1HGCV2FA9SB601815";
const deal: Quote = {
  ...emptyQuote(),
  vin: VIN,
  year: 2026,
  vehicle: "Honda Civic Sport",
  dealerName: "Lakeside Honda — Café",
  sellingPrice: 29500,
  outTheDoor: 32100,
  apr: 6.9,
  termMonths: 60,
  down: 3000,
  fees: [{ label: "Doc fee", amount: 599, kind: "dealer" }],
  car: { year: 2026, make: "Honda", model: "Civic", trim: "Sport", miles: 12, status: "active" },
};
const pack = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

describe("share link", () => {
  it("round-trips a deal, non-ASCII text included", () => {
    expect(decodeDeal(`#d=${encodeDeal(deal)}`)).toEqual({ ...deal, source: "manual", unconfirmed: [] });
  });
  it("builds the url with a fragment", () => {
    expect(shareUrl("https://lowkey.autos", deal)).toMatch(/^https:\/\/lowkey\.autos\/quote#d=[A-Za-z0-9_-]+$/);
  });
  it("never carries unconfirmed fields", () => {
    const back = decodeDeal(`#d=${encodeDeal({ ...deal, unconfirmed: ["apr"], source: "photo" })}`);
    expect(back?.unconfirmed).toEqual([]);
    expect(back?.source).toBe("manual");
  });
  it("accepts the hash with or without the #", () => {
    const p = encodeDeal(deal)!;
    expect(decodeDeal(`d=${p}`)).not.toBeNull();
    expect(decodeDeal(`#d=${p}`)).not.toBeNull();
  });
  it("rejects garbage, a tampered payload and a wrong version", () => {
    expect(decodeDeal("")).toBeNull();
    expect(decodeDeal("#d=%%%")).toBeNull();
    expect(decodeDeal("#d=bm90IGpzb24")).toBeNull();
    const p = encodeDeal(deal)!;
    expect(decodeDeal(`#d=${p.slice(0, -6)}AAAAAA`)).toBeNull();
    expect(decodeDeal(`#d=${pack({ v: 2, q: deal })}`)).toBeNull();
  });
  it("rejects a schema violation and a VIN that fails its check digit", () => {
    expect(decodeDeal(`#d=${pack({ v: 1, q: { ...deal, apr: 99 } })}`)).toBeNull();
    expect(decodeDeal(`#d=${pack({ v: 1, q: { ...deal, vin: "1HGCV2FA0SB601815" } })}`)).toBeNull();
  });
  it("refuses to encode or decode an oversize deal", () => {
    const big: Quote = {
      ...deal,
      fees: Array.from({ length: 30 }, (_, i) => ({ label: "x".repeat(115) + i, amount: 1, kind: "dealer" as const })),
    };
    expect(encodeDeal(big)).toBeNull();
    expect(decodeDeal(`#d=${"A".repeat(MAX_PAYLOAD + 1)}`)).toBeNull();
  });
});
