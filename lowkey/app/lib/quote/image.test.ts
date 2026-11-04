import { describe, expect, it } from "vitest";

import { fitScale, MAX_SIDE } from "./image";

describe("fitScale", () => {
  it("shrinks the long side to the limit and never enlarges", () => {
    expect(fitScale(4032, 3024)).toBeCloseTo(MAX_SIDE / 4032, 6);
    expect(fitScale(3024, 4032)).toBeCloseTo(MAX_SIDE / 4032, 6);
    expect(fitScale(800, 600)).toBe(1);
    expect(fitScale(0, 0)).toBe(1);
  });
});
