import { describe, expect, it } from "vitest";

import { emptyQuote, quoteFromRead, quoteSchema } from "./schema";

describe("quoteFromRead, terms mode (task 057)", () => {
  it("maps a terms read and marks it unconfirmed", () => {
    const q = quoteFromRead({
      doc_type: "terms",
      mode: "terms",
      vin: "1HGCV2FA9SB601815",
      vin_check_ok: true,
      selling_price: 28450,
      msrp: null,
      price_basis: "selling",
      down: 3000,
      out_the_door: 31204.1,
      stated_monthly: 512.33,
      apr: 6.9,
      term_months: 72,
      mileage: 18420,
      fees: [],
      payment_options: [],
    });
    expect(q.readMode).toBe("terms");
    expect(q.mileage).toBe(18420);
    expect(q.sellingPrice).toBe(28450);
    expect(q.vin).toBe("1HGCV2FA9SB601815");
    expect(q.unconfirmed).toContain("mileage");
    expect(q.fees).toEqual([]);
  });
  it("uses the MSRP as the price when that is all the sticker shows", () => {
    const q = quoteFromRead({ doc_type: "terms", mode: "terms", selling_price: null, msrp: 27315, price_basis: "msrp" });
    expect(q.sellingPrice).toBe(27315);
    expect(q.priceIsSticker).toBe(true);
  });
  it("a full read is unchanged", () => {
    const q = quoteFromRead({ doc_type: "buyers_order", selling_price: 20000, mileage: 50 });
    expect(q.readMode).toBeUndefined();
    expect(q.mileage).toBeNull();
  });
  it("old drafts without the new fields still parse", () => {
    // emptyQuote() sets neither readMode nor car, like a draft saved before task 057.
    expect(quoteSchema.safeParse(emptyQuote()).success).toBe(true);
  });
  it("a quote with a car parses", () => {
    const car = { year: 2026, make: "Honda", model: "CR-V", trim: "Sport Hybrid", miles: 10, status: "active" as const };
    expect(quoteSchema.safeParse({ ...emptyQuote(), car }).success).toBe(true);
  });
});
