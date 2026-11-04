import { describe, expect, it } from "vitest";

import { priceForModel, resolvePick, retentionForModel } from "./fixtures";

describe("resolvePick (model-name matching for tool callers)", () => {
  it("matches the bare fixture model", () => {
    expect(resolvePick("CR-V")?.make).toBe("Honda");
    expect(resolvePick("Venue")?.make).toBe("Hyundai");
  });

  it("matches the make-plus-model form the chat model sends", () => {
    expect(resolvePick("Honda CR-V")?.model).toBe("CR-V");
    expect(resolvePick("Toyota Corolla Cross")?.model).toBe("Corolla Cross");
    expect(resolvePick("hyundai venue")?.model).toBe("Venue");
  });

  it("prefers the longest model name (Silverado 1500 over bare 1500)", () => {
    expect(resolvePick("Chevrolet Silverado 1500")?.make).toBe("Chevrolet");
    expect(resolvePick("Ram 1500")?.make).toBe("Ram");
    expect(resolvePick("1500")?.make).toBe("Ram");
  });

  it("returns undefined for an unknown model", () => {
    expect(resolvePick("Not A Car")).toBeUndefined();
    expect(retentionForModel("Not A Car")).toBeUndefined();
    expect(priceForModel("Not A Car")).toBeUndefined();
  });

  it("resolves retention and price through the same match", () => {
    expect(retentionForModel("Honda CR-V")).toBe(0.629);
    expect(priceForModel("Honda CR-V")).toBe(34899);
  });
});
