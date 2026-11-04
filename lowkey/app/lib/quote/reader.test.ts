import { describe, expect, it } from "vitest";

import { allowRead, READS_PER_HOUR } from "./reader";

describe("allowRead", () => {
  it("limits each address per hour and recovers after the window", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < READS_PER_HOUR; i += 1) expect(allowRead("a", t0 + i)).toBe(true);
    expect(allowRead("a", t0 + 100)).toBe(false);
    expect(allowRead("b", t0 + 100)).toBe(true);
    expect(allowRead("a", t0 + 61 * 60 * 1000)).toBe(true);
  });
});
