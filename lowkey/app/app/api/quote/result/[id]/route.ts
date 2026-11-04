import { readSchema } from "@/lib/quote/schema";
import { readerFetch } from "@/lib/quote/reader";

export const maxDuration = 20;

/** Poll a read: pending, failed, or done with a schema-checked result. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^fc-[A-Za-z0-9]{6,60}$/.test(id)) return Response.json({ status: "failed" }, { status: 404 });
  try {
    const res = await readerFetch(`/result/${id}`, { method: "GET", timeoutMs: 10000 });
    if (!res) return Response.json({ status: "failed" }, { status: 503 });
    if (res.status === 202) return Response.json({ status: "pending" }, { status: 202 });
    const data = (await res.json()) as { status?: string; quote?: unknown };
    if (data.status !== "done") return Response.json({ status: "failed" });
    const parsed = readSchema.safeParse(data.quote);
    if (!parsed.success) return Response.json({ status: "failed" });
    return Response.json({ status: "done", read: parsed.data });
  } catch {
    return Response.json({ status: "pending" }, { status: 202 });
  }
}
