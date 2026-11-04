import { describe, expect, it } from "vitest";

import {
  initialSearch,
  parseLastSearch,
  parseSearchQuery,
  restoreAction,
  resultsLink,
  resumeHeading,
  searchMessage,
  searchQuery,
  serializeLastSearch,
  typeFromCategory,
} from "./search";

describe("search URL (task 041, part 3)", () => {
  it("round-trips a search through the URL", () => {
    const s = { zip: "60614", type: "suv" as const };
    expect(searchQuery(s)).toBe("?zip=60614&type=suv");
    expect(parseSearchQuery(searchQuery(s))).toEqual({ search: s, sort: null });
  });

  it("keeps a non-default sort and drops the default", () => {
    const s = { zip: "30097", type: "pickup" as const };
    expect(searchQuery(s, "nearest")).toBe("?zip=30097&type=pickup&sort=nearest");
    expect(searchQuery(s, "real")).toBe("?zip=30097&type=pickup");
    expect(parseSearchQuery("?zip=30097&type=pickup&sort=nearest")).toEqual({
      search: s,
      sort: "nearest",
    });
  });

  it("rejects a bad ZIP or type and ignores a bad sort", () => {
    expect(parseSearchQuery("?zip=6061&type=suv")).toBeNull();
    expect(parseSearchQuery("?zip=60614&type=van")).toBeNull();
    expect(parseSearchQuery("")).toBeNull();
    expect(parseSearchQuery("?zip=60614&type=SUV&sort=cheapest")).toEqual({
      search: { zip: "60614", type: "suv" },
      sort: null,
    });
  });

  it("builds the results link and the chat message", () => {
    const s = { zip: "60614", type: "suv" as const };
    expect(resultsLink("https://low-key-murex.vercel.app/", s)).toBe(
      "https://low-key-murex.vercel.app/?zip=60614&type=suv",
    );
    expect(searchMessage(s)).toBe("60614, SUV");
    expect(searchMessage({ zip: "30097", type: "pickup" })).toBe("30097, Pickup");
    expect(resumeHeading(s)).toBe("Your SUVs near 60614");
    expect(resumeHeading({ zip: "10001", type: "sedan" })).toBe("Your sedans near 10001");
  });

  it("maps rank categories to URL types", () => {
    expect(typeFromCategory("SUV")).toBe("suv");
    expect(typeFromCategory("Pickup")).toBe("pickup");
    expect(typeFromCategory("Minivan")).toBeNull();
    expect(typeFromCategory(undefined)).toBeNull();
  });
});

describe("stored last search (task 041, part 3)", () => {
  it("round-trips through storage", () => {
    const s = { zip: "60614", type: "sedan" as const };
    expect(parseLastSearch(serializeLastSearch(s))).toEqual(s);
  });

  it("treats junk, old shapes and bad values as nothing stored", () => {
    expect(parseLastSearch(null)).toBeNull();
    expect(parseLastSearch("not json")).toBeNull();
    expect(parseLastSearch(JSON.stringify({ zip: "60614", type: "suv" }))).toBeNull();
    expect(parseLastSearch(JSON.stringify({ v: 1, zip: "6061", type: "suv" }))).toBeNull();
  });

  it("restores the stored search when the URL names none, and the URL wins", () => {
    const stored = serializeLastSearch({ zip: "60614", type: "suv" });
    expect(initialSearch("", stored)).toEqual({
      search: { zip: "60614", type: "suv" },
      sort: null,
      from: "stored",
    });
    expect(initialSearch("?zip=30097&type=pickup", stored)).toEqual({
      search: { zip: "30097", type: "pickup" },
      sort: null,
      from: "url",
    });
    expect(initialSearch("", null)).toBeNull();
  });
});

describe("restore action (resume card)", () => {
  it("runs a link at once and offers a remembered search", () => {
    const stored = serializeLastSearch({ zip: "60614", type: "suv" });
    expect(restoreAction(initialSearch("?zip=30097&type=pickup", stored)!)).toBe("run");
    expect(restoreAction(initialSearch("", stored)!)).toBe("offer");
  });
});
