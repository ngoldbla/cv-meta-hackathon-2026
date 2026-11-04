/**
 * VIN from a barcode (task 057): window stickers and door jambs carry
 * the VIN as a Code 39, Code 128, Data Matrix or QR code. Decoding runs
 * on the device; the image is never sent anywhere for this step.
 */

import { vinCheckOk } from "./schema";

/** The first 17-character run whose check digit holds, or null. */
export function vinFromBarcodeText(text: string): string | null {
  const s = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  for (let i = 0; i + 17 <= s.length; i += 1) {
    const cand = s.slice(i, i + 17);
    if (vinCheckOk(cand)) return cand;
  }
  return null;
}

let prepared = false;

async function reader() {
  const zx = await import("zxing-wasm/reader");
  if (!prepared) {
    // Served from our own origin (copied at build time), not a CDN.
    zx.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/zxing_reader.wasm" : prefix + path),
      },
    });
    prepared = true;
  }
  return zx;
}

const FORMATS = ["Code39", "Code128", "DataMatrix", "QRCode"] as const;

function firstVin(results: { text?: string }[]): string | null {
  for (const r of results) {
    const vin = vinFromBarcodeText(r.text ?? "");
    if (vin) return vin;
  }
  return null;
}

/** The VIN in a photo's barcode, or null (no barcode, unreadable, or no wasm). Never throws. */
export async function decodeVin(file: Blob): Promise<string | null> {
  try {
    const zx = await reader();
    return firstVin(await zx.readBarcodes(file, { formats: [...FORMATS], tryHarder: true, maxNumberOfSymbols: 4 }));
  } catch {
    return null; // no barcode path: the read's VIN or a typed one takes over
  }
}

/** The VIN in one live camera frame, or null. Fast settings: a scanner calls this several times a second. */
export async function decodeVinFrame(frame: ImageData): Promise<string | null> {
  try {
    const zx = await reader();
    return firstVin(await zx.readBarcodes(frame, { formats: [...FORMATS], tryHarder: false, maxNumberOfSymbols: 4 }));
  } catch {
    return null;
  }
}
