import { headers } from "next/headers";

import HomeClient from "./HomeClient";
import { parseVercelArea } from "@/lib/geo";

/**
 * Server wrapper (task 030, part 1): the starting search area comes
 * from Vercel's request headers, read server-side and passed to the
 * client. No prompt, no permission; the client confirms or changes
 * it, and a stored confirmed area wins on return visits.
 */
export default async function Page() {
  const headerList = await headers();
  const initialArea = parseVercelArea(headerList);
  return <HomeClient initialArea={initialArea} />;
}
