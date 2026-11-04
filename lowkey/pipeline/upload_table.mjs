/**
 * Upload the depreciation table to private Blob storage (task 027).
 * Usage: node lowkey/pipeline/upload_table.mjs [table.json]
 * Needs BLOB_READ_WRITE_TOKEN in the environment (load
 * ~/.config/low-key/env in the shell; never print the token).
 * Prints only the pathname and byte size.
 */
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { put } from "@vercel/blob";

const PATHNAME = "lowkey/table.json";
const file =
  process.argv[2] ?? join(homedir(), ".cache", "low-key", "table.json");
const body = readFileSync(file);
const size = statSync(file).size;
const result = await put(PATHNAME, body, {
  access: "private",
  allowOverwrite: true,
  addRandomSuffix: false,
  contentType: "application/json",
  token: process.env.BLOB_READ_WRITE_TOKEN,
});
console.log(`uploaded ${result.pathname} (${size} bytes)`);
