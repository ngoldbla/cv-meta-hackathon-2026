/**
 * Resumable results (task 041, part 3). The page URL reflects the
 * search (`?zip=60614&type=suv`, plus `&sort=` when it is not the
 * default), so a shared or reopened link reruns the same fast-path
 * search. The last search is also remembered in localStorage. Only
 * the ZIP, the type and the sort are kept; results are always re-run,
 * never restored from storage.
 */

import { DEFAULT_SORT, isSortKey, type SortKey } from "./chooser";

export type SearchType = "sedan" | "suv" | "pickup";

export interface SavedSearch {
  zip: string;
  type: SearchType;
}

const TYPE_LABEL: Record<SearchType, string> = {
  sedan: "Sedan",
  suv: "SUV",
  pickup: "Pickup",
};

const TYPE_PLURAL: Record<SearchType, string> = {
  sedan: "sedans",
  suv: "SUVs",
  pickup: "pickups",
};

export const LAST_SEARCH_KEY = "lowkey-last-search";

function isType(value: unknown): value is SearchType {
  return value === "sedan" || value === "suv" || value === "pickup";
}

function isZip(value: unknown): value is string {
  return typeof value === "string" && /^\d{5}$/.test(value);
}

/** "SUV" (a rank_category category) -> "suv". */
export function typeFromCategory(category: string | null | undefined): SearchType | null {
  const t = (category ?? "").trim().toLowerCase();
  return isType(t) ? t : null;
}

/** "suv" -> "SUV", the type button's label. */
export function typeLabel(type: SearchType): string {
  return TYPE_LABEL[type];
}

/** The chat message that runs this search on the fast path. */
export function searchMessage(s: SavedSearch): string {
  return `${s.zip}, ${TYPE_LABEL[s.type]}`;
}

/** "Your SUVs near 60614". */
export function resumeHeading(s: SavedSearch): string {
  return `Your ${TYPE_PLURAL[s.type]} near ${s.zip}`;
}

/** "?zip=60614&type=suv" (with "&sort=nearest" when not the default). */
export function searchQuery(s: SavedSearch, sort: SortKey = DEFAULT_SORT): string {
  const params = new URLSearchParams({ zip: s.zip, type: s.type });
  if (sort !== DEFAULT_SORT) params.set("sort", sort);
  return `?${params.toString()}`;
}

/** The shareable results link for the deal sheet. */
export function resultsLink(origin: string, s: SavedSearch, sort?: SortKey): string {
  return `${origin.replace(/\/$/, "")}/${searchQuery(s, sort)}`;
}

/** A page query -> the search it names, or null. Unknown keys are ignored. */
export function parseSearchQuery(
  query: string,
): { search: SavedSearch; sort: SortKey | null } | null {
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const zip = params.get("zip")?.trim() ?? "";
  const type = params.get("type")?.trim().toLowerCase() ?? "";
  if (!isZip(zip) || !isType(type)) return null;
  const sort = params.get("sort");
  return { search: { zip, type }, sort: isSortKey(sort) ? sort : null };
}

export function serializeLastSearch(s: SavedSearch): string {
  return JSON.stringify({ v: 1, zip: s.zip, type: s.type });
}

export function parseLastSearch(raw: string | null | undefined): SavedSearch | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { v?: unknown; zip?: unknown; type?: unknown };
    if (v.v !== 1 || !isZip(v.zip) || !isType(v.type)) return null;
    return { zip: v.zip, type: v.type };
  } catch {
    return null;
  }
}

/**
 * Which search to run when the page opens: a search in the URL wins
 * (a shared or reopened link), then the remembered last search.
 */
export function initialSearch(
  query: string,
  stored: string | null,
): { search: SavedSearch; sort: SortKey | null; from: "url" | "stored" } | null {
  const fromUrl = parseSearchQuery(query);
  if (fromUrl) return { ...fromUrl, from: "url" };
  const last = parseLastSearch(stored);
  return last ? { search: last, sort: null, from: "stored" } : null;
}

/**
 * What to do with the search found on open: a link runs at once (it
 * was shared or reopened to see results); a remembered search is
 * offered on the resume card and runs only when tapped, so a return
 * visit spends no provider calls until the shopper asks.
 */
export function restoreAction(init: { from: "url" | "stored" }): "run" | "offer" {
  return init.from === "url" ? "run" : "offer";
}
