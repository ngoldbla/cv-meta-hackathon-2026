import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

function req(texts: string[]) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: texts.map((t, i) => ({ id: String(i), role: "user", parts: [{ type: "text", text: t }] })),
    }),
  });
}

describe("chat route without model credits (task 050)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("answers a free-text question with a calm fixed reply, not an error", async () => {
    vi.stubEnv("LOWKEY_CHAT_MODEL_ON", "");
    const res = await POST(req(["60614 suv", "Which one is quietest on the highway?"]));
    const body = await res.text();
    expect(body).not.toMatch(/"type":"error"/);
    expect(body).toMatch(/works from the controls rather than chat/);
    expect(body).toMatch(/Check a quote/);
  });
});
