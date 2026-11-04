import { describe, expect, it } from "vitest";

import fixture from "./fixtures/vin-response.json";
import { allowVin, lookupVin, mapVinResponse, VIN_PER_HOUR } from "./vin";

const VIN = "1HGCV2FA9SB601815";
const res = (status: number, body: unknown = {}) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("mapVinResponse", () => {
  it("keeps only the facts the quote uses", () => {
    const f = mapVinResponse(fixture);
    expect(f).not.toBeNull();
    expect(f!.vin).toBe(VIN);
    expect(f!.status).toBe("active");
    expect(f!.year).toBe(2026);
    expect(f!.make).toBe("Honda");
    expect(f!.msrp).toBe(38580);
    expect(f!.miles).toBe(10);
    expect(f!.dealerName).toBe("Example Motors");
    expect(Object.keys(f!).sort()).toEqual(
      ["dealerName", "listedPrice", "make", "miles", "model", "msrp", "status", "trim", "vin", "year"].sort(),
    );
  });
  it("rejects a body without data", () => {
    expect(mapVinResponse({})).toBeNull();
    expect(mapVinResponse(null)).toBeNull();
  });
});

describe("lookupVin", () => {
  const opts = { baseUrl: "https://example.test/v1", apiKey: "k" };
  it("never calls the provider for a VIN whose check digit fails", async () => {
    let called = false;
    const fetcher = (() => {
      called = true;
      return res(200, fixture);
    }) as unknown as typeof fetch;
    const r = await lookupVin("1HGCV2FA0SB601815", { ...opts, fetcher });
    expect(r).toEqual({ ok: false, reason: "bad_vin" });
    expect(called).toBe(false);
  });
  it("returns the facts on 200 and calls the VIN path", async () => {
    let url = "";
    const fetcher = ((u: string) => {
      url = u;
      return res(200, fixture);
    }) as unknown as typeof fetch;
    const r = await lookupVin(VIN.toLowerCase(), { ...opts, fetcher });
    expect(url).toBe(`https://example.test/v1/vins/${VIN}`);
    expect(r.ok).toBe(true);
  });
  it("maps 404 to not_found and anything else to unavailable", async () => {
    const f = (status: number) => (() => res(status)) as unknown as typeof fetch;
    expect(await lookupVin(VIN, { ...opts, fetcher: f(404) })).toEqual({ ok: false, reason: "not_found" });
    expect(await lookupVin(VIN, { ...opts, fetcher: f(500) })).toEqual({ ok: false, reason: "unavailable" });
    const boom = (() => Promise.reject(new Error("timeout"))) as unknown as typeof fetch;
    expect(await lookupVin(VIN, { ...opts, fetcher: boom })).toEqual({ ok: false, reason: "unavailable" });
  });
  it("is unavailable without configuration", async () => {
    expect(await lookupVin(VIN, { baseUrl: "", apiKey: "" })).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("allowVin", () => {
  it("limits each address per hour", () => {
    const t0 = 5_000_000;
    for (let i = 0; i < VIN_PER_HOUR; i += 1) expect(allowVin("x", t0 + i)).toBe(true);
    expect(allowVin("x", t0 + 100)).toBe(false);
    expect(allowVin("y", t0 + 100)).toBe(true);
  });
});
