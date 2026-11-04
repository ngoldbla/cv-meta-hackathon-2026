import { z } from "zod";

import { pickSlug } from "@/lib/render/specs";
import { requestFromParams } from "@/lib/searchRun";
import { executeFarther, executeRankCategory } from "@/lib/tools";

export const maxDuration = 30;

const schema = z.object({
  zip: z.string().regex(/^\d{5}$/),
  type: z.enum(["sedan", "suv", "pickup", "minivan", "hybrid"]),
  car: z.string().regex(/^[a-z0-9-]{1,80}$/),
  years: z.enum(["all"]).optional(),
});

/**
 * `GET /api/farther?zip=&type=&car=` (task 054): far-away leads for one
 * car in the lineup. The one on-demand provider call per car, made only
 * when the shopper opens "Better prices farther away"; cached 6 hours.
 */
export async function GET(req: Request) {
  const parsed = schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 400 });
  const { zip, type, car, years } = parsed.data;
  const { category } = requestFromParams({ zip, type });
  try {
    const rank = await executeRankCategory(category);
    const pick = [...rank.picks, ...(rank.commodity ? [rank.commodity] : [])].find((p) => pickSlug(p) === car);
    if (!pick) return Response.json({ error: "not in this lineup" }, { status: 404 });
    const out = await executeFarther({ zip, model: pick.model, category, allYears: years === "all" });
    return Response.json(out, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "search failed" }, { status: 502 });
  }
}
