import { describe, expect, it } from "vitest";

import {
  downForPrice,
  parseConversationFastRequest,
  parseFastRequest,
} from "./fastpath";

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

  it("keeps the first-message behaviour via the conversation parser", () => {
    expect(parseConversationFastRequest(["60614, SUV"])).toEqual(
      parseFastRequest("60614, SUV"),
    );
    expect(parseConversationFastRequest(["Sedan"])).toBeNull();
    expect(parseConversationFastRequest(["60614"])).toBeNull();
    expect(parseConversationFastRequest([])).toBeNull();
  });

  it("runs the fast path when the pair is split across turns", () => {
    // Bare "Sedan" after "60614" (task 030 fixture).
    expect(parseConversationFastRequest(["60614", "Sedan"])).toEqual({
      zip: "60614",
      category: "Sedan",
      userApr: null,
      downFixed: null,
      downPercent: null,
    });
    // "30097" after "60614, SUV" searches SUV at the new ZIP.
    expect(
      parseConversationFastRequest(["60614, SUV", "30097"]),
    ).toEqual({
      zip: "30097",
      category: "SUV",
      userApr: null,
      downFixed: null,
      downPercent: null,
    });
    // Latest ZIP and latest category win.
    expect(
      parseConversationFastRequest(["60614, Sedan", "what about SUVs?"])
        ?.category,
    ).toBe("SUV");
    expect(
      parseConversationFastRequest(["60614, SUV", "try 30097"])?.zip,
    ).toBe("30097");
  });

  it("sends down-payment-only follow-ups to the model", () => {
    expect(
      parseConversationFastRequest([
        "60614, SUV",
        "What if I put $5k down?",
      ]),
    ).toBeNull();
    expect(
      parseConversationFastRequest(["60614, SUV", "hello"]),
    ).toBeNull();
  });

  it("carries APR and down-payment overrides, latest wins", () => {
    const r = parseConversationFastRequest([
      "60614, SUV, my rate is 5.9%",
      "Sedan",
    ])!;
    expect(r.userApr).toBe(5.9);
    expect(r.category).toBe("Sedan");
    const d = parseConversationFastRequest([
      "60614 SUV $5k down",
      "30097",
    ])!;
    expect(d.downFixed).toBe(5000);
    expect(d.zip).toBe("30097");
    const latest = parseConversationFastRequest([
      "60614, SUV, my rate is 5.9%",
      "30097, my rate is 4.9%",
    ])!;
    expect(latest.userApr).toBe(4.9);
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
