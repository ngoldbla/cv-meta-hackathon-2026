import { readerFetch } from "@/lib/quote/reader";

export const maxDuration = 20;

/** Start the photo reader loading while the shopper picks a photo. */
export async function POST() {
  try {
    const res = await readerFetch("/warm", { method: "POST", timeoutMs: 10000 });
    if (!res) return Response.json({ reader: "off" }, { status: 503 });
    return Response.json({ reader: res.ok ? "warming" : "unavailable" }, { status: res.ok ? 202 : 503 });
  } catch {
    return Response.json({ reader: "unavailable" }, { status: 503 });
  }
}
