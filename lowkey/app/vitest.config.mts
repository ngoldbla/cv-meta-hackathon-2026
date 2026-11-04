import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// The same "@/..." alias as tsconfig.json, so route handlers can be tested.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
