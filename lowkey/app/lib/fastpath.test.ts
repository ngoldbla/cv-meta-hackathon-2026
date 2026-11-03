import { describe, expect, it } from "vitest";

import { downForPrice, parseFastRequest } from "./fastpath";

describe("parseFastRequest (task 026 part 5)", () => {
  it("detects ZIP + category in the first message", () => {
    expect(parseFastRequest("60614, SUV")).toEqual({
      zip: "60614",
      category: "SUV",
      userApr: null,
      downFixed: null,
      downPercent: null,
    });
    expect(parseFastRequest("Only pickups near 30097")?.category).toBe("Pickup");
    expect(parseFastRequest("sedans near 60614")?.category).toBe("Sedan");
    expect(parseFastRequest("SUVs near 59001")?.zip).toBe("59001");
  });

  it("requires both a ZIP and a category", () => {
    expect(parseFastRequest("SUV")).toBeNull();
    expect(parseFastRequest("60614")).toBeNull();
    expect(parseFastRequest("What if I put $5k down?")).toBeNull();
    expect(parseFastRequest("hello")).toBeNull();
  });

  it("carries a user-stated rate and down payment", () => {
    const r = parseFastRequest("60614, SUV, my rate is 5.9%")!;
    expect(r.userApr).toBe(5.9);
    const d = parseFastRequest("60614 SUV $5k down")!;
    expect(d.downFixed).toBe(5000);
    expect(downForPrice(d, 34899)).toBe(5000);
    expect(downForPrice(parseFastRequest("60614, SUV")!, 34899)).toBeCloseTo(3489.9, 2);
  });
});
