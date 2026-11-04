import { describe, expect, it } from "vitest";

import { monthlyPayment } from "../ownership";
import { analyzeQuote, headsUp, impliedApr, PAYMENT_TOLERANCE, type PickDeal, type SameTerms } from "./compare";
import { emptyQuote, quoteFromRead, vinCheckOk, type Quote } from "./schema";

const TERMS: SameTerms = { downRule: { kind: "share", share: 0.1 }, aprPercent: 7, termMonths: 60 };

/** Five invented quotes (task 046, part 3). */
function q(over: Partial<Quote>): Quote {
  return { ...emptyQuote(), ...over };
}
const plain = q({
  sellingPrice: 28450,
  down: 2000,
  apr: 7.25,
  termMonths: 60,
  fees: [
    { label: "Documentary fee", amount: 799, kind: "dealer" },
    { label: "Title and registration", amount: 185, kind: "government" },
  ],
});
const heavyAddons = q({
  ...plain,
  fees: [
    ...plain.fees,
    { label: "Nitrogen tire fill", amount: 199, kind: "addon" },
    { label: "Paint and fabric protection", amount: 995, kind: "addon" },
    { label: "Market prep", amount: 400, kind: "unknown" },
  ],
});
const used = q({ ...plain, used: true, mileage: 24000, sellingPrice: 21900 });
const rebate = q({ ...plain, rebates: 1500 });
const minimal = q({ outTheDoor: 31000 });

describe("analyzeQuote", () => {
  it("sums the lines when no total is stated, and says so", () => {
    const r = analyzeQuote(plain, TERMS);
    if (!r.ok) throw new Error("expected ok");
    expect(r.analysis.outTheDoor).toBe(28450 + 799 + 185);
    expect(r.analysis.outTheDoorSource).toBe("sum");
    expect(r.analysis.questions).toContain("Is this the out-the-door price with every fee and tax?");
  });

  it("recomputes the payment from the quote's own numbers", () => {
    const r = analyzeQuote(plain, TERMS);
    if (!r.ok) throw new Error("expected ok");
    const financed = 28450 + 799 + 185 - 2000;
    expect(r.analysis.asQuoted?.amountFinanced).toBe(financed);
    expect(r.analysis.asQuoted?.monthly).toBeCloseTo(monthlyPayment(financed, 7.25, 60), 2);
  });

  it("flags a stated payment that doesn't match, calmly, beyond $5 only", () => {
    const base = analyzeQuote(plain, TERMS);
    if (!base.ok || !base.analysis.asQuoted) throw new Error("expected ok");
    const right = base.analysis.asQuoted.monthly;
    const close = analyzeQuote(q({ ...plain, statedMonthly: right + PAYMENT_TOLERANCE - 1 }), TERMS);
    const off = analyzeQuote(q({ ...plain, statedMonthly: right + 43 }), TERMS);
    if (!close.ok || !off.ok) throw new Error("expected ok");
    expect(close.analysis.paymentGap).toBeNull();
    expect(off.analysis.paymentGap).toBeCloseTo(43, 2);
    expect(off.analysis.questions.join(" ")).toMatch(/doesn't match/);
  });

  it("totals add-ons on their own line and asks about unknown fees", () => {
    const r = analyzeQuote(heavyAddons, TERMS);
    if (!r.ok) throw new Error("expected ok");
    expect(r.analysis.addonTotal).toBe(1194);
    expect(r.analysis.questions).toContain("Can the add-ons come off?");
    expect(r.analysis.questions.join(" ")).toMatch(/Market prep/);
  });

  it("flags a stated total that doesn't match its lines", () => {
    const r = analyzeQuote(q({ ...plain, outTheDoor: 29434 + 250 }), TERMS);
    if (!r.ok) throw new Error("expected ok");
    expect(r.analysis.outTheDoorSource).toBe("stated");
    expect(r.analysis.totalGap).toBe(250);
  });

  it("subtracts a rebate from the total", () => {
    const r = analyzeQuote(rebate, TERMS);
    if (!r.ok) throw new Error("expected ok");
    expect(r.analysis.outTheDoor).toBe(28450 - 1500 + 799 + 185);
  });

  it("prices a used quote the same way", () => {
    const r = analyzeQuote(used, TERMS);
    if (!r.ok) throw new Error("expected ok");
    expect(r.analysis.price).toBe(21900);
  });

  it("degrades on a minimal quote instead of throwing", () => {
    const r = analyzeQuote(minimal, TERMS);
    if (!r.ok) throw new Error("expected ok");
    expect(r.analysis.asQuoted).toBeNull();
    expect(r.analysis.sameTerms.termMonths).toBe(60);
    expect(analyzeQuote(emptyQuote(), TERMS)).toEqual({
      ok: false,
      missing: ["the vehicle price or the out-the-door total"],
    });
  });

  it("refuses to compare until photo fields are confirmed", () => {
    const fromPhoto = quoteFromRead({ doc_type: "buyers_order", selling_price: 28450, apr: 7.25, term_months: 60 });
    expect(analyzeQuote(fromPhoto, TERMS).ok).toBe(false);
    expect(analyzeQuote({ ...fromPhoto, unconfirmed: [] }, TERMS).ok).toBe(true);
  });

  it("uses the model's retention when given, else says typical", () => {
    const a = analyzeQuote(plain, TERMS, { retention5y: 0.7 });
    const b = analyzeQuote(plain, TERMS);
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(a.analysis.retentionSource).toBe("model");
    expect(b.analysis.retentionSource).toBe("typical");
  });
});

describe("headsUp", () => {
  const pick: PickDeal = {
    model: "Honda Civic",
    price: 26900,
    taxAmount: 1700,
    downPayment: 2690,
    aprPercent: 7,
    termMonths: 60,
    monthlyPayment: 513.12,
    positiveEquityMonth: 14,
  };

  it("adds the pick's estimated tax only when the quote lists no sales tax", () => {
    const withTax = headsUp(plain, pick, { kind: "share", share: 0.1 }, null, 1990);
    if (!withTax.ok) throw new Error("expected ok");
    expect(withTax.addedTax).toBe(1990);
    expect(withTax.rows[1].quote).toBe(28450 + 799 + 185 + 1990);
    const listed = q({ ...plain, fees: [...plain.fees, { label: "State sales tax", amount: 1990, kind: "government" }] });
    const again = headsUp(listed, pick, { kind: "share", share: 0.1 }, null, 1990);
    if (!again.ok) throw new Error("expected ok");
    expect(again.addedTax).toBeNull();
  });

  it("prices the quote on the pick's terms and shows plain differences", () => {
    const r = headsUp(plain, pick, { kind: "share", share: 0.1 });
    if (!r.ok) throw new Error("expected ok");
    const monthly = r.rows[0];
    expect(monthly.pick).toBe(513.12);
    expect(monthly.difference).toBeCloseTo((monthly.quote as number) - 513.12, 2);
    expect(r.rows[1].pick).toBe(28600);
  });
});

describe("quoteFromRead", () => {
  it("drops a VIN whose check digit fails and marks read fields unconfirmed", () => {
    const good = quoteFromRead({ doc_type: "window_sticker", vin: "1HGCV2FA9SB601815", msrp: 28450 });
    expect(good.vin).toBe("1HGCV2FA9SB601815");
    expect(good.unconfirmed).toEqual(expect.arrayContaining(["msrp", "vin"]));
    const bad = quoteFromRead({ doc_type: "window_sticker", vin: "1HGCV2FA0SB601815" });
    expect(bad.vin).toBeNull();
  });

  it("ignores out-of-range values instead of trusting them", () => {
    const r = quoteFromRead({ doc_type: "other", apr: 72, term_months: 3, selling_price: -5, year: 1066 });
    expect([r.apr, r.termMonths, r.sellingPrice, r.year]).toEqual([null, null, null, null]);
  });

  it("checks VINs the same way the reader does", () => {
    expect(vinCheckOk("1HGCV2FA9SB601815")).toBe(true);
    expect(vinCheckOk("1HGCV2FA9SB60181O")).toBe(false);
  });
});

describe("a real dealer worksheet (task 047, numbers only)", () => {
  // Price, fees, down payment, amount financed and the payment grid from a
  // real buyer's worksheet; no names, VIN or contact details.
  const sheet: Quote = {
    ...emptyQuote(),
    sellingPrice: 22995,
    down: 2000,
    amountFinanced: 23993.51,
    fees: [
      { label: "Doc Fee", amount: 999, kind: "dealer" },
      { label: "Electronic Filing Fee", amount: 299, kind: "dealer" },
      { label: "Total Taxes", amount: 1700.51, kind: "government" },
    ],
    paymentOptions: [
      { down: 2000, termMonths: 60, low: 500, high: 525 },
      { down: 2000, termMonths: 72, low: 434, high: 459 },
      { down: 4000, termMonths: 60, low: 458, high: 483 },
    ],
  };

  it("agrees with the sheet's amount financed", () => {
    const r = analyzeQuote(sheet, TERMS);
    if (!r.ok) throw new Error("expected ok");
    expect(r.analysis.outTheDoor).toBeCloseTo(25993.51, 2);
    expect(r.analysis.financedGap).toBeNull();
  });

  it("works out the APR the payment estimates imply, for this down payment only", () => {
    const r = analyzeQuote(sheet, TERMS);
    if (!r.ok) throw new Error("expected ok");
    expect(r.analysis.estimates.map((e) => e.termMonths)).toEqual([60, 72]);
    const [e60, e72] = r.analysis.estimates;
    expect(e60.financed).toBeCloseTo(23993.51, 2);
    expect(e60.aprLow).toBeCloseTo(9.17, 1);
    expect(e60.aprHigh).toBeCloseTo(11.28, 1);
    expect(e72.aprLow).toBeCloseTo(9.13, 1);
    expect(r.analysis.questions.join(" ")).toMatch(/What APR/);
  });

  it("flags an amount financed that doesn't match the lines", () => {
    const r = analyzeQuote({ ...sheet, amountFinanced: 24493.51 }, TERMS);
    if (!r.ok) throw new Error("expected ok");
    expect(r.analysis.financedGap).toBeCloseTo(500, 2);
  });
});

describe("impliedApr", () => {
  it("inverts the payment formula", () => {
    const p = monthlyPayment(20000, 6.5, 60);
    expect(impliedApr(20000, p, 60)).toBeCloseTo(6.5, 2);
    expect(impliedApr(20000, 300, 60)).toBeNull(); // below zero interest
  });
});

describe("a window sticker", () => {
  it("uses the sticker total as the price, adds the make from the VIN, and asks for a selling price", () => {
    const q = quoteFromRead({
      doc_type: "window_sticker",
      vin: "1HGCV2FA9SB601815",
      make_from_vin: "Honda",
      vehicle_text: "Zenith Sport",
      msrp: 37763,
    });
    expect(q.sellingPrice).toBe(37763);
    expect(q.priceIsSticker).toBe(true);
    expect(q.vehicle).toBe("Honda Zenith Sport");
    const r = analyzeQuote({ ...q, unconfirmed: [] }, TERMS);
    if (!r.ok) throw new Error("expected ok");
    expect(r.analysis.questions).toContain("What is your selling price for this car, out the door?");
  });
});

describe("terms reads (task 057)", () => {
  it("shows fees as one signed lump and never flags a total gap", () => {
    const r = analyzeQuote(q({ source: "photo", readMode: "terms", sellingPrice: 28000, outTheDoor: 30500 }), TERMS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.analysis.feesLump).toBe(2500);
    expect(r.analysis.totalGap).toBeNull();
  });
  it("a rebate makes the lump negative", () => {
    const r = analyzeQuote(q({ source: "photo", readMode: "terms", sellingPrice: 28000, outTheDoor: 27000 }), TERMS);
    expect(r.ok && r.analysis.feesLump).toBe(-1000);
  });
  it("an itemized quote has no lump", () => {
    const r = analyzeQuote(q({ sellingPrice: 28000, outTheDoor: 30500 }), TERMS);
    expect(r.ok && r.analysis.feesLump).toBeNull();
  });
  it("a used car's resale curve changes the positive-equity month", () => {
    const base = q({ sellingPrice: 25000, outTheDoor: 26500, down: 2500, apr: 7, termMonths: 60 });
    const newer = analyzeQuote(base, TERMS, { retention5y: 0.55 });
    const used = analyzeQuote(base, TERMS, { retention5y: 0.55, resaleFactor: () => 0.97, basis: "used-age-miles" });
    expect(newer.ok && used.ok).toBe(true);
    if (!newer.ok || !used.ok) return;
    expect(used.analysis.resaleBasis).toBe("used-age-miles");
    expect(used.analysis.sameTerms.positiveEquityMonth).not.toEqual(newer.analysis.sameTerms.positiveEquityMonth);
  });
});
