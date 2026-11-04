// Task 057: serve the barcode reader's wasm from our own origin.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
copyFileSync(
  require.resolve("zxing-wasm/reader/zxing_reader.wasm"),
  new URL("../public/zxing_reader.wasm", import.meta.url),
);
