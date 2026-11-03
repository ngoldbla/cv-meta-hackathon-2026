import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import { downForPrice, parseFastRequest } from "@/lib/fastpath";
import { aprLabel, getDefaultApr } from "@/lib/fred";
import {
  executeLocalUnits,
  executeOwnership,
  executeRankCategory,
  lowkeyTools,
} from "@/lib/tools";

export const maxDuration = 60;

const SYSTEM = `You are Low Key, a car-buying chat that tells someone who needs a car now which new gas car to buy nearby, what it costs per month, and what it would cost to walk away from it. No ads, no forms, no shopping.

Rules:
- If the user has not yet given a ZIP and a type, ask one question only: "What's your ZIP, and do you need a sedan, an SUV or a pickup?" Do not show picks before you have both.
- Any mention of sedans, SUVs or pickups as a type to consider is a request for the ranking: call rank_category for that category (map plurals to Sedan, SUV or Pickup). A ZIP never replaces the ranking when a category is named.
- Show at most 4 ranked picks plus the commodity pick. Never show more, and never turn the chat into a browsing tool.
- After rank_category, call ownership_math for each pick you will show (use its price and 10% down over 60 months unless the user said otherwise; omit apr so the server uses the Federal Reserve average, and pass apr only when the user states their own rate, for example "my rate is 5.9%") and call local_units for each pick with the user's ZIP. In both calls, set model to the exact model string from rank_category (for example "CR-V", not "Honda CR-V").
- Do not write a "why this car" sentence or any closing summary: the cards already show a code-written summary. Keep your own text to short replies to follow-up questions, with no numbers except ones copied verbatim from tool results. Never invent or compute numbers: if a number is not in a tool result, do not state it.
- Use plain words and short answers. Say the sample-data tools are sample data when you mention prices or stock.
- The user can ask follow-ups in plain words, such as "What if I put $5k down?" — answer by calling ownership_math again.
- The model never does arithmetic. Every number on screen comes from a tool result.`;

function getModel() {
  const provider = createOpenAICompatible({
    name: "meta",
    baseURL: "https://api.meta.ai/v1",
    apiKey: process.env.META_API_KEY,
  });
  return provider(process.env.LOWKEY_CHAT_MODEL ?? "muse-spark-1.3");
}

function userText(message: UIMessage | undefined): string {
  if (!message) return "";
  return (message.parts ?? [])
    .filter(
      (p): p is { type: "text"; text: string } =>
        p.type === "text" && typeof (p as { text?: unknown }).text === "string",
    )
    .map((p) => p.text)
    .join(" ");
}

/**
 * Fast path (task 026, part 5): a first message with a ZIP and a
 * category is answered by calling the tools directly, in parallel,
 * and streaming them as tool-result parts. No model call, so the
 * cards arrive in well under the 15-second target. The code-written
 * summary is rendered by the client from the same tool results.
 */
async function fastPathResponse(text: string) {
  const req = parseFastRequest(text);
  if (!req) return null;
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const stamp = Date.now().toString(36);
      let n = 0;
      const callId = (name: string) => `call-fast-${stamp}-${name}-${(n += 1)}`;
      writer.write({ type: "start-step" });
      const rankId = callId("rank");
      writer.write({
        type: "tool-input-available",
        toolCallId: rankId,
        toolName: "rank_category",
        input: { category: req.category },
      });
      const rank = await executeRankCategory(req.category);
      writer.write({
        type: "tool-output-available",
        toolCallId: rankId,
        output: rank,
      });
      const shown = [...rank.picks];
      if (!shown.some((p) => p.model === rank.commodity.model)) {
        shown.push({ ...rank.commodity });
      }
      // One shared FRED lookup (1-day cached) unless the user
      // stated their own rate.
      const aprInfo = req.userApr === null ? await getDefaultApr() : null;
      const jobs: Promise<void>[] = [];
      for (const pick of shown) {
        const ownId = callId("own");
        const locId = callId("loc");
        const ownInput = {
          price: pick.price,
          down: downForPrice(req, pick.price),
          apr: req.userApr ?? undefined,
          term: 60,
          model: pick.model,
        };
        const locInput = { zip: req.zip, model: pick.model };
        writer.write({
          type: "tool-input-available",
          toolCallId: ownId,
          toolName: "ownership_math",
          input: ownInput,
        });
        writer.write({
          type: "tool-input-available",
          toolCallId: locId,
          toolName: "local_units",
          input: locInput,
        });
        jobs.push(
          (async () => {
            const out = await executeOwnership({
              ...ownInput,
              apr:
                req.userApr ??
                (aprInfo ? aprInfo.aprPercent : undefined),
            });
            writer.write({
              type: "tool-output-available",
              toolCallId: ownId,
              output: aprInfo
                ? {
                    ...out,
                    aprDate: aprInfo.dateIso,
                    aprAssumed: aprInfo.assumed,
                    aprLabel: aprLabel(aprInfo),
                  }
                : out,
            });
          })(),
        );
        jobs.push(
          (async () => {
            const out = await executeLocalUnits(locInput);
            writer.write({
              type: "tool-output-available",
              toolCallId: locId,
              output: out,
            });
          })(),
        );
      }
      await Promise.all(jobs);
      writer.write({ type: "finish-step" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  // Fast path only for the very first user turn.
  if (messages.length === 1 && messages[0]?.role === "user") {
    const fast = await fastPathResponse(userText(messages[0]));
    if (fast) return fast;
  }
  if (!process.env.META_API_KEY) {
    return Response.json(
      { error: "META_API_KEY is not set on the server." },
      { status: 500 },
    );
  }
  const result = streamText({
    model: getModel(),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    tools: lowkeyTools,
    stopWhen: stepCountIs(12),
    // Muse Spark spends hidden reasoning tokens before it answers
    // (P10: at 1600 the reply was empty), so allow 4000. Reasoning
    // effort "minimal" is accepted by the Meta API (probe, task
    // 026 part 5) and cuts reasoning tokens sharply; the fast path
    // above covers the first cards, this covers follow-ups.
    reasoning: "minimal",
    maxOutputTokens: 4000,
    onFinish: ({ usage, totalUsage }) => {
      console.log(
        "[lowkey] chat finish usage=" +
          JSON.stringify(totalUsage ?? usage ?? null),
      );
    },
  });
  return result.toUIMessageStreamResponse();
}
