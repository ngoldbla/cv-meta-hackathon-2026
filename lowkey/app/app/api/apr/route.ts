import { aprLabel, getDefaultApr } from "@/lib/fred";

export const maxDuration = 30;

/** Current default APR (Federal Reserve series, 1-day cached). */
export async function GET() {
  const info = await getDefaultApr();
  return Response.json({ ...info, label: aprLabel(info) });
}
