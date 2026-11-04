import { describe, expect, it } from "vitest";

import { RANK_FIXTURES } from "./fixtures";
import { ownershipMath } from "./ownership";
import {
  cardSentence,
  equityHeadline,
  positiveEquityLabel,
  sellLine,
  underwaterLabel,
  yoursAt5YearsLabel,
} from "./summary";

function ownershipFor(modelPrice: number, retention: number) {
  return ownershipMath({
    price: modelPrice,
    apr: 8,
    term: 60,
    retention5y: retention,
  });
}

/** Every number in the sentence must appear in a tool result. */
function numbersIn(text: string): number[] {
  return (text.match(/\d[\d,]*\.?\d*/g) ?? []).map((s) =>
    Number(s.replace(/,/g, "")),
  );
}

describe("cardSentence (code-written, task 026 part 4)", () => {
  const fixture = RANK_FIXTURES.SUV;
  const peers = [...fixture.picks, fixture.commodity];
  const crv = fixture.picks[0];
  const crvOwn = ownershipFor(crv.price, crv.retention5y);

  it("builds the top pick sentence from tool numbers only", () => {
    const s = cardSentence(crv, crvOwn, peers, "SUV");
    expect(s).toBe(
      "Keeps about 63% of its price after 5 years — most here.",
    );
    // Number check: each sentence number traces to a tool result.
    const allowed = new Set<number>([
      Math.round(crv.retention5y * 100),
      5,
    ]);
    for (const n of numbersIn(s)) expect(allowed.has(n)).toBe(true);
  });

  it("does not claim the superlative for other picks", () => {
    const venue = fixture.commodity;
    const s = cardSentence(venue, ownershipFor(venue.price, venue.retention5y), peers, "SUV");
    expect(s).not.toContain("the most of any");
    expect(s).toContain(`Keeps about ${Math.round(venue.retention5y * 100)}%`);
  });

  it("never shows the retail percentage when retail and after-discount differ", () => {
    // CR-V shape (task 031): retail 74%, after-discount 63%.
    const pick = { rank: 1, make: "Honda", model: "CR-V", price: 34899, retention5y: 0.629, depPerMonth: 216 };
    const s = cardSentence(pick, undefined, [pick], "SUV");
    expect(s).toContain("63%");
    expect(s).not.toContain("74%");
  });

  it("handles missing ownership without inventing numbers", () => {
    const s = cardSentence(crv, undefined, peers, "SUV");
    expect(s).toBe(
      "Keeps about 63% of its price after 5 years — most here.",
    );
  });

  it("keeps the card sentence to retention alone (task 029 salient face)", () => {
    const own = ownershipMath({
      price: 33000, down: 3300, apr: 8, term: 60, retention5y: 0.629,
    });
    const pick = { rank: 1, make: "Honda", model: "CR-V", price: 33000, retention5y: 0.629, depPerMonth: 216 };
    const s = cardSentence(pick, own, [pick], "SUV");
    // Single-peer lineup: no superlative claim, and no walk-away
    // numbers on the card face (they live in the walk-away view).
    expect(s).toBe("Keeps about 63% of its price after 5 years.");
    expect(positiveEquityLabel(own.positiveEquityMonth)).toBe(
      "Positive equity by month 7",
    );
    // Legacy alias returns the same positive-equity phrasing.
    expect(underwaterLabel(own.positiveEquityMonth)).toBe(
      "Positive equity by month 7",
    );
  });
});

describe("cardSentence with trim and lifespan (task 029, part 4)", () => {
  it("names the step-up trim and the lifespan when known", () => {
    const pick = {
      rank: 4, make: "Toyota", model: "Corolla", price: 28295,
      retention5y: 0.577, depPerMonth: 199,
      baseTrim: "LE", stepUpTrim: "SE", recommendedTrim: "SE",
      trimIsStepUp: true, lifespanYears: 11.3,
    };
    const s = cardSentence(pick, ownershipFor(28295, 0.577), [pick], "Sedan");
    expect(s).toContain("SE (one step up): keeps about 58%");
    expect(s).toContain("Lasts about 11 years.");
  });

  it("omits trim and lifespan clauses when they are unknown", () => {
    const fixture = RANK_FIXTURES.SUV;
    const crvPick = fixture.picks[0];
    const s = cardSentence(
      crvPick,
      ownershipFor(crvPick.price, crvPick.retention5y),
      [...fixture.picks, fixture.commodity],
      "SUV",
    );
    expect(s).not.toContain("one step up");
    expect(s).not.toContain("Built to last");
  });
});

describe("positiveEquityLabel (task 039 templates)", () => {
  it("labels the small chart", () => {
    expect(positiveEquityLabel(7)).toBe("Positive equity by month 7");
    expect(positiveEquityLabel(1)).toBe("Positive equity by month 1");
    expect(positiveEquityLabel(0)).toBe("Positive equity from day one");
    expect(positiveEquityLabel(null)).toBe(
      "Equity stays below zero for the loan",
    );
    expect(positiveEquityLabel(undefined)).toBe(
      "Equity stays below zero for the loan",
    );
  });

  it("headlines the walk-away view with a full stop", () => {
    expect(equityHeadline(7)).toBe("Positive equity by month 7.");
    expect(equityHeadline(0)).toBe("Positive equity from day one.");
    expect(equityHeadline(null)).toBe("Equity stays below zero for the loan.");
  });

  it("names what is yours at 5 years from the equity figure", () => {
    expect(yoursAt5YearsLabel(20113)).toBe("$20,113 yours at 5 years");
    expect(yoursAt5YearsLabel(0)).toBe("$0 yours at 5 years");
  });

  it("sells at the slider month with about-dollars (nearest $100)", () => {
    expect(sellLine(36, 10118)).toBe("Sell at month 36: about $10,100 is yours");
    expect(sellLine(6, -1234)).toBe("Sell at month 6: you'd owe about $1,200");
    expect(sellLine(36, 0)).toBe("Sell at month 36: about $0 is yours");
  });
});
