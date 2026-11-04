import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Task 049: Low Key is an interactive web app with no chat and no model in
// the search path. These checks keep it that way.
const ROOT = join(__dirname, "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

const files = ["app", "components", "lib"].flatMap((d) => sources(join(ROOT, d)));

describe("no chat (task 049)", () => {
  it("has no chat route", () => {
    expect(existsSync(join(ROOT, "app/api/chat"))).toBe(false);
  });

  it("depends on no AI SDK", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps.filter((d) => d === "ai" || d.startsWith("@ai-sdk/"))).toEqual([]);
  });

  it("imports no chat or model client and asks no one to type", () => {
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/from "ai"|from "@ai-sdk\//);
      expect(s, f).not.toMatch(/useChat|api\/chat|META_API_KEY|LOWKEY_CHAT_MODEL/);
      expect(s, f).not.toMatch(/my rate is|in the chat|Ask a question/i);
    }
  });
});
