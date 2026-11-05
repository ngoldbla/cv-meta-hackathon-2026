/**
 * Car names from the catalogue (the depreciation table), looked up by the
 * route's slug. Names only: no listings call. When the table is
 * unreachable (a build, an outage) the name falls back to the slug.
 */
import { pickSlug } from "./render/specs";
import { nameFromSlug } from "./seo";
import { getTable } from "./table";

export async function carName(slug: string): Promise<string> {
  try {
    const table = await getTable();
    for (const lineup of Object.values(table.lineups)) {
      if (!lineup) continue;
      for (const p of [...lineup.picks, ...(lineup.commodity ? [lineup.commodity] : [])]) {
        if (pickSlug(p) === slug) return `${p.make} ${p.model}`;
      }
    }
  } catch {
    // fall through to the slug
  }
  return nameFromSlug(slug);
}

/** Every car page's [type, slug] pair, for the sitemap. Empty when the table is unreachable. */
export async function carRoutes(): Promise<{ type: string; slug: string }[]> {
  try {
    const table = await getTable();
    const out: { type: string; slug: string }[] = [];
    const seen = new Set<string>();
    for (const [category, lineup] of Object.entries(table.lineups)) {
      if (!lineup) continue;
      const type = category.toLowerCase();
      for (const p of [...lineup.picks, ...(lineup.commodity ? [lineup.commodity] : [])]) {
        const key = `${type}/${pickSlug(p)}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ type, slug: pickSlug(p) });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}
