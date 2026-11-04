// @vitest-environment node
import { describe, expect, it } from "vitest";

import { vinFromBarcodeText } from "./barcode";

const VIN = "1HGCV2FA9SB601815";

describe("vinFromBarcodeText", () => {
  it("accepts a plain VIN", () => expect(vinFromBarcodeText(VIN)).toBe(VIN));
  it("drops the leading I some Code 39 VIN labels carry", () => expect(vinFromBarcodeText(`I${VIN}`)).toBe(VIN));
  it("finds the VIN inside a longer payload", () => expect(vinFromBarcodeText(`XX ${VIN} 2026`)).toBe(VIN));
  it("rejects a VIN whose check digit fails", () => expect(vinFromBarcodeText("1HGCV2FA0SB601815")).toBeNull());
  it("rejects noise", () => expect(vinFromBarcodeText("hello")).toBeNull());
});

describe("a generated barcode", () => {
  it("reads a Code 39 VIN back", async () => {
    const { writeBarcode, readBarcodes } = await import("zxing-wasm/full");
    const written = await writeBarcode(VIN, { format: "Code39", scale: 2 });
    expect(written.image).toBeTruthy();
    const read = await readBarcodes(written.image as Blob, { formats: ["Code39"] });
    expect(vinFromBarcodeText(read[0]?.text ?? "")).toBe(VIN);
  });
});
