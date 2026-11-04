import { clientKey } from "@/lib/quote/reader";
import { getTable, resolveTablePick } from "@/lib/table";
import { allowVin, lookupVin } from "@/lib/vin";

export const maxDuration = 10;

/** The car's facts for a VIN, plus its model's resale history when Low Key has one. */
export async function GET(req: Request) {
  const vin = new URL(req.url).searchParams.get("vin") ?? "";
  if (!allowVin(clientKey(req))) return Response.json({ ok: false, reason: "resting" }, { status: 429 });
  const result = await lookupVin(vin);
  if (!result.ok) return Response.json(result, { status: result.reason === "bad_vin" ? 400 : 200 });
  let retention = null;
  try {
    const { make, model } = result.facts;
    const hit = model ? resolveTablePick(await getTable(), make ? `${make} ${model}` : model) : undefined;
    if (hit) {
      retention = {
        retention5y: hit.pick.retentionAfterDiscount,
        byAge: hit.pick.retentionByAge ?? null,
        slopePerYear: hit.pick.retentionSlopePerYear ?? null,
      };
    }
  } catch {
    retention = null; // the typical curve applies, and the screen says so
  }
  return Response.json({ ...result, retention });
}
