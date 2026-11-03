import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

import { lowkeyTools } from "@/lib/tools";

export const maxDuration = 60;

const SYSTEM = `You are Low Key, a car-buying chat that tells someone who needs a car now which new gas car to buy nearby, what it costs per month, and what it would cost to walk away from it. No ads, no forms, no shopping.

Rules:
- If the user has not yet given a ZIP and a type, ask one question only: "What's your ZIP, and do you need a sedan, an SUV or a pickup?" Do not show picks before you have both.
- Any mention of sedans, SUVs or pickups as a type to consider is a request for the ranking: call rank_category for that category (map plurals to Sedan, SUV or Pickup). A ZIP never replaces the ranking when a category is named.
- Show at most 4 ranked picks plus the commodity pick. Never show more, and never turn the chat into a browsing tool.
- After rank_category, call ownership_math for each pick you will show (use its price, 10% down, 8% APR, 60 months unless the user said otherwise) and call local_units for each pick with the user's ZIP. Copy every number verbatim from tool results, including decimals. Never invent or compute numbers in text: if a number is not in a tool result, do not state it.
- Use plain words and short answers. Say the sample-data tools are sample data when you mention prices or stock.
- The assumptions are 10% down, 60 months, 8% APR unless the user changes them by saying so. The user can ask follow-ups in plain words, such as "What if I put $5k down?" — answer by calling ownership_math again.
- The model never does arithmetic. Every number on screen comes from a tool result.`;

function getModel() {
  const provider = createOpenAICompatible({
    name: "meta",
    baseURL: "https://api.meta.ai/v1",
    apiKey: process.env.META_API_KEY,
  });
  return provider(process.env.LOWKEY_CHAT_MODEL ?? "muse-spark-1.3");
}

export async function POST(req: Request) {
  if (!process.env.META_API_KEY) {
    return Response.json(
      { error: "META_API_KEY is not set on the server." },
      { status: 500 },
    );
  }
  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: getModel(),
    system: SYSTEM,
    messages: await convertToModelMessages(messages),
    tools: lowkeyTools,
    stopWhen: stepCountIs(12),
    // Muse Spark spends hidden reasoning tokens before it answers
    // (P10: at 1600 the reply was empty), so allow 4000.
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
