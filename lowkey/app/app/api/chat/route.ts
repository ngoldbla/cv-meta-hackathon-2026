import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import {
  downForPrice,
  parseConversationFastRequest,
  type FastRequest,
} from "@/lib/fastpath";
import { aprLabel, getDefaultApr } from "@/lib/fred";
import { checkCostCompareSpec, checkPickCardSpec } from "@/lib/render/guard";
import {
  buildCostCompareSpec,
  buildPickCardSpec,
  turnLabels,
  type SpecEntry,
} from "@/lib/render/specs";
import {
  executeLocalUnits,
  executeOwnership,
  executeRankCategory,
  lowkeyTools,
} from "@/lib/tools";

export const maxDuration = 60;

const SYSTEM = `You are Low Key. Your job is helping someone get a car without regret, so a car you can leave cheaply is the main reason to choose it: say when the owner reaches positive equity (the month the car is worth more than the loan) and what is theirs if they sell. Never use the word "underwater"; say "positive equity by month N" instead. You tell someone who needs a car now which new car (gas, or a full hybrid) to buy nearby, what it costs per month, and what it would cost to walk away from it. No ads, no forms, no shopping.

Rules:
- Never ask for a ZIP or a body type that the user has already given in this conversation; if one is still missing, ask only for that one, in one short sentence. If neither has been given, ask for both in one short sentence. Do not show picks before you have both.
- Any mention of sedans, SUVs, pickups, minivans (or vans) or hybrids as a type to consider is a request for the ranking: call rank_category for that category (map plurals to Sedan, SUV, Pickup, Minivan or Hybrid; "hybrid" wins over a body word, so "a hybrid SUV" is Hybrid). Electric cars and plug-in hybrids are not covered yet: say so in one short sentence. A ZIP never replaces the ranking when a category is named.
- Show at most 4 picks plus the commodity pick. Never show more, and never turn the chat into a browsing tool.
- The cars have no order of preference: every car shown is one Low Key stands behind, and the shopper sorts them. Never call a car "#1", "number one", "top pick", "the best" or "first choice", and never number the cars. You may repeat a car's best-at label (for example "holds value best" or "cheapest to own") when it is in the results.
- After rank_category, call local_units for each pick with the user's ZIP, then ownership_math for each pick with model and zip (the server prices the cheapest local unit, or the labelled typical price when there is none; use 10% down over 60 months unless the user said otherwise; omit apr so the server uses the Federal Reserve average, and pass apr only when the user states their own rate, for example "my rate is 5.9%"). In both calls, set model to the exact model string from rank_category (for example "CR-V", not "Honda CR-V") and category to the rank_category category.
- Do not write a "why this car" sentence or any closing summary: the cards already show a code-written summary. Keep your own text to short replies to follow-up questions, with no numbers except ones copied verbatim from tool results. Never invent or compute numbers: if a number is not in a tool result, do not state it.
- Use plain words and short answers, in a calm tone: no urgency, no pressure, no exclamation marks.
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
 * Fast path (task 026, part 5; task 030, part 3): a request whose
 * conversation gives a ZIP and a category is answered by calling
 * the tools directly and streaming them as tool-result parts. No
 * model call, so the cards arrive in well under the 15-second
 * target. The code-written summary is rendered by the client from
 * the same tool results.
 */
async function fastPathResponse(req: FastRequest) {
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
      let rank;
      try {
        rank = await executeRankCategory(req.category);
      } catch {
        writer.write({ type: "finish-step" });
        return;
      }
      writer.write({
        type: "tool-output-available",
        toolCallId: rankId,
        output: rank,
      });
      const shown = [...rank.picks];
      if (
        rank.commodity &&
        !shown.some((p) => p.model === rank.commodity!.model)
      ) {
        shown.push({ ...rank.commodity });
      }
      // One shared FRED lookup (1-day cached) unless the user
      // stated their own rate.
      const aprInfo = req.userApr === null ? await getDefaultApr() : null;
      // Local stock first, one search at a time (Tier 1 rate limit;
      // at most one provider call per pick at 50 miles): payments
      // price the cheapest local unit.
      const locals = [];
      for (const pick of shown) {
        locals.push(
          await executeLocalUnits({ zip: req.zip, model: pick.model, category: req.category }),
        );
      }
      const specEntries: SpecEntry[] = [];
      for (let i = 0; i < shown.length; i += 1) {
        const pick = shown[i];
        const local = locals[i];
        const locId = callId("loc");
        writer.write({
          type: "tool-input-available",
          toolCallId: locId,
          toolName: "local_units",
          input: { zip: req.zip, model: pick.model, category: req.category },
        });
        writer.write({
          type: "tool-output-available",
          toolCallId: locId,
          output: local,
        });
        const price = local.bestPrice ?? pick.typicalNewPrice;
        const ownId = callId("own");
        const ownInput = {
          price,
          down: downForPrice(req, price),
          apr: req.userApr ?? undefined,
          term: 60,
          model: pick.model,
          zip: req.zip,
          category: req.category,
        };
        writer.write({
          type: "tool-input-available",
          toolCallId: ownId,
          toolName: "ownership_math",
          input: ownInput,
        });
        const out = await executeOwnership({
          ...ownInput,
          downRule:
            req.downFixed !== null
              ? { kind: "amount", usd: req.downFixed }
              : { kind: "share", share: (req.downPercent ?? 10) / 100 },
          retention5y: pick.retention5y,
          priceSource: local.bestPrice !== null && local.bestPrice !== undefined ? "local" : "typical",
          apr:
            req.userApr ??
            (aprInfo ? aprInfo.aprPercent : undefined),
        });
        const ownOutput = aprInfo
          ? {
              ...out,
              aprDate: aprInfo.dateIso,
              aprAssumed: aprInfo.assumed,
              aprLabel: aprLabel(aprInfo),
            }
          : out;
        writer.write({
          type: "tool-output-available",
          toolCallId: ownId,
          output: ownOutput,
        });
        specEntries.push({
          pick: pick as unknown as SpecEntry["pick"],
          ownership: ownOutput as unknown as SpecEntry["ownership"],
          local: local as unknown as SpecEntry["local"],
        });
      }
      // Server-built card specs (task 034), streamed as data parts.
      // Task 040: built after every car is in, because the best-at
      // labels compare the whole lineup (the client's chooser fills
      // in from the tool results meanwhile). A spec that fails the
      // number guard is dropped (logged without data) and the client
      // falls back to text.
      const labels = turnLabels(specEntries);
      for (const entry of specEntries) {
        const cardSpec = buildPickCardSpec(
          entry,
          shown as unknown as SpecEntry["pick"][],
          req.category,
          labels.get(entry.pick.model) ?? [],
        );
        if (checkPickCardSpec(cardSpec, entry).ok) {
          writer.write({
            type: "data-lowkey-spec",
            data: { kind: "card", model: entry.pick.model, spec: cardSpec },
          });
        } else {
          console.error(
            "lowkey: dropped a render spec that failed the number guard",
          );
        }
      }
      const compareSpec = buildCostCompareSpec(specEntries, req.category);
      if (compareSpec) {
        if (checkCostCompareSpec(compareSpec, specEntries).ok) {
          writer.write({
            type: "data-lowkey-spec",
            data: { kind: "compare", spec: compareSpec },
          });
        } else {
          console.error(
            "lowkey: dropped a render spec that failed the number guard",
          );
        }
      }
      writer.write({ type: "finish-step" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  // Fast path on any user turn that, with the conversation so far,
  // gives a ZIP and a category (task 030, part 3).
  const userTexts = messages
    .filter((m) => m.role === "user")
    .map((m) => userText(m));
  const fastReq = parseConversationFastRequest(userTexts);
  if (fastReq) return fastPathResponse(fastReq);
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
