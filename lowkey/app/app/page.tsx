import { headers } from "next/headers";
import { redirect } from "next/navigation";

import StartClient from "./StartClient";
import { parseVercelArea } from "@/lib/geo";
import { parseSearchQuery } from "@/lib/search";

/**
 * The start screen (task 049). The starting area comes from Vercel's
 * request headers, read server-side (task 030). A link from before 049
 * (`/?zip=60614&type=suv`) opens its lineup on the new results route.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const flat = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v] as [string, string]] : [])),
  );
  const legacy = parseSearchQuery(flat.toString());
  if (legacy) {
    const q = new URLSearchParams({ zip: legacy.search.zip });
    if (legacy.sort && legacy.sort !== "real") q.set("sort", legacy.sort);
    redirect(`/${legacy.search.type}?${q.toString()}`);
  }
  const initialArea = parseVercelArea(await headers());
  return <StartClient initialArea={initialArea} />;
}
