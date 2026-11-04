import { allowRead, clientKey, readerFetch } from "@/lib/quote/reader";

export const maxDuration = 30;

const MAX_B64 = 8 * 1024 * 1024; // about 6 MB of image
const MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Start reading a photo; returns an id to poll. The image is passed through, never kept. */
export async function POST(req: Request) {
  let body: { image_b64?: unknown; mime?: unknown; mode?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const image = typeof body.image_b64 === "string" ? body.image_b64 : "";
  const mime = typeof body.mime === "string" ? body.mime : "image/jpeg";
  // Task 057: "terms" reads only the money terms; anything else is the full read.
  const mode = body.mode === "terms" ? "terms" : "full";
  if (!image || image.length > MAX_B64 || !MIMES.has(mime)) {
    return Response.json({ error: "unsupported image" }, { status: 413 });
  }
  if (!allowRead(clientKey(req))) {
    return Response.json({ error: "resting" }, { status: 429 });
  }
  try {
    const res = await readerFetch("/read", {
      method: "POST",
      body: JSON.stringify({ image_b64: image, mime, mode }),
      timeoutMs: 20000,
    });
    if (!res) return Response.json({ error: "reader off" }, { status: 503 });
    if (res.status === 429) return Response.json({ error: "resting" }, { status: 429 });
    if (!res.ok) return Response.json({ error: "unavailable" }, { status: 503 });
    const { id } = (await res.json()) as { id?: string };
    return Response.json({ id }, { status: 202 });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
