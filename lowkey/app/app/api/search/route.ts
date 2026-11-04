import { requestFromParams, runSearch, searchParamsSchema } from "@/lib/searchRun";

export const maxDuration = 60;

/**
 * `GET /api/search?zip=&type=&down=&downPct=&apr=&term=` (task 049): the
 * picks, local units, ownership and guard-checked card specs as JSON.
 * Same code, caching and provider rate limits as the old chat fast path.
 */
export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  delete params.sort; // the sort is the page's, not the search's
  const parsed = searchParamsSchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: "invalid search", issues: parsed.error.issues.map((i) => i.path.join(".") || i.message) }, { status: 400 });
  }
  try {
    const result = await runSearch(requestFromParams(parsed.data));
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "search failed" }, { status: 502 });
  }
}
