import { describe, expect, it } from "vitest";

import { bestAtLabels, sortFacts, type ChooserFacts } from "./chooser";

const CARS: ChooserFacts[] = [
  { model: "A", label: "Honda A", retention: 0.63, total: 461, bills: 640, nearestMiles: 12, lifespanYears: 14 },
  { model: "B", label: "Toyota B", retention: 0.62, total: 455, bills: 610, nearestMiles: null, lifespanYears: 16 },
  { model: "C", label: "Mazda C", retention: 0.6, total: 470, bills: 600, nearestMiles: 4, lifespanYears: null },
  { model: "D", label: "Hyundai D", retention: 0.57, total: 455, bills: 590, nearestMiles: 30, lifespanYears: 12 },
];

const order = (rows: ChooserFacts[]) => rows.map((r) => r.model);

describe("chooser sort orders (task 040)", () => {
  it("Real cost: lowest first, ties by name", () => {
    // B and D tie at 455: Hyundai D before Toyota B by name.
    expect(order(sortFacts(CARS, "real"))).toEqual(["D", "B", "A", "C"]);
  });

  it("Monthly: lowest bills first", () => {
    expect(order(sortFacts(CARS, "monthly"))).toEqual(["D", "C", "B", "A"]);
  });

  it("Nearest: closest first, no local unit last", () => {
    expect(order(sortFacts(CARS, "nearest"))).toEqual(["C", "A", "D", "B"]);
  });

  it("Lasts longest: longest first, unrated last", () => {
    expect(order(sortFacts(CARS, "lasts"))).toEqual(["B", "A", "D", "C"]);
  });

  it("does not change its input", () => {
    const before = order(CARS);
    sortFacts(CARS, "nearest");
    expect(order(CARS)).toEqual(before);
  });
});

describe("best-at labels (task 040)", () => {
  it("shares a label between cars that read the same once rounded", () => {
    const close = [
      { ...CARS[0]!, nearestMiles: 13.7, lifespanYears: 14.2 },
      { ...CARS[1]!, nearestMiles: 13.8, lifespanYears: 14.4 },
      { ...CARS[2]!, nearestMiles: 20, lifespanYears: 12 },
    ];
    const labels = bestAtLabels(close);
    expect(labels.get("A")).toEqual(expect.arrayContaining(["Nearest", "Lasts longest"]));
    expect(labels.get("B")).toEqual(expect.arrayContaining(["Nearest", "Lasts longest"]));
    expect(labels.get("C")).not.toContain("Nearest");
  });

  it("gives each label to the best car, ties shared", () => {
    const labels = bestAtLabels(CARS);
    expect(labels.get("A")).toEqual(["Holds value best"]);
    expect(labels.get("B")).toEqual(["Cheapest to own", "Lasts longest"]);
    expect(labels.get("C")).toEqual(["Nearest"]);
    expect(labels.get("D")).toEqual(["Cheapest to own", "Lowest monthly"]);
  });

  it("skips a label every car ties on, or no car has", () => {
    const flat = CARS.map((c) => ({ ...c, bills: 600, nearestMiles: null }));
    const labels = bestAtLabels(flat);
    for (const l of labels.values()) {
      expect(l).not.toContain("Lowest monthly");
      expect(l).not.toContain("Nearest");
    }
  });

  it("gives no labels to a lone car", () => {
    expect(bestAtLabels([CARS[0]!]).get("A")).toEqual([]);
  });
});
