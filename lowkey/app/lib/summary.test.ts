import { describe, expect, it } from "vitest";

import { RANK_FIXTURES } from "./fixtures";
import { ownershipMath } from "./ownership";
import { cardSentence, closingLine, underwaterLabel } from "./summary";

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
      "Keeps 63% of its price after 5 years, the most of any gas SUV here.",
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
    expect(s).toContain(`Keeps ${Math.round(venue.retention5y * 100)}%`);
  });

  it("handles missing ownership without inventing numbers", () => {
    const s = cardSentence(crv, undefined, peers, "SUV");
    expect(s).toBe(
      "Keeps 63% of its price after 5 years, the most of any gas SUV here.",
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
    expect(s).toBe("Keeps 63% of its price after 5 years.");
    expect(underwaterLabel(own.evenMonth)).toBe("Underwater for 7 months");
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
    expect(s).toContain("The SE is one step up from base and keeps 58%");
    expect(s).toContain("Built to last about 11 years.");
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

describe("closingLine", () => {
  it("names the #1 pick with payment, retention and leave cost", () => {
    const fixture = RANK_FIXTURES.SUV;
    const entries = fixture.picks.map((pick) => ({
      pick,
      ownership: ownershipFor(pick.price, pick.retention5y),
    }));
    const line = closingLine(entries, "SUV")!;
    expect(line).toContain("Honda CR-V");
    const top = entries[0].ownership!;
    expect(line).toContain(`$${Math.round(top.monthlyPayment).toLocaleString("en-US")}`);
    expect(line).toContain("63%");
  });

  it("returns null for an empty lineup", () => {
    expect(closingLine([], "SUV")).toBeNull();
  });
});

describe("underwaterLabel", () => {
  it("labels the small chart", () => {
    expect(underwaterLabel(7)).toBe("Underwater for 7 months");
    expect(underwaterLabel(1)).toBe("Underwater for 1 month");
    expect(underwaterLabel(0)).toBe("Never underwater");
    expect(underwaterLabel(null)).toBe("Underwater for the whole term");
  });
});
