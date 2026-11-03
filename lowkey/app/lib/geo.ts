/**
 * Search-area helpers (task 030).
 *
 * The starting guess comes from Vercel's request headers, read
 * server-side. "Use my location" turns browser coordinates into a
 * ZIP through the free, keyless US Census geocoder
 * (geographies/coordinates); the ZIP lookup for the Change field
 * goes ZIP centroid (TIGERweb) -> the same Census geographies call.
 * Coordinates are rounded to 2 decimals before they are sent
 * anywhere and are never logged or stored.
 */

export interface SearchArea {
  zip: string;
  city: string | null;
  state: string | null;
  /** True for the header guess, which is labelled approximate. */
  approximate?: boolean;
}

export function isValidZip(value: string | null | undefined): boolean {
  return typeof value === "string" && /^\d{5}$/.test(value.trim());
}

function decodeHeader(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

type HeaderGetter = { get(name: string): string | null };

/**
 * Starting guess from Vercel's headers. Used only when the country
 * is `US` and the postal code is 5 digits; otherwise null.
 */
export function parseVercelArea(headers: HeaderGetter): SearchArea | null {
  const country = headers.get("x-vercel-ip-country")?.trim();
  if (country !== "US") return null;
  const postal = headers.get("x-vercel-ip-postal-code")?.trim();
  if (!postal || !/^\d{5}$/.test(postal)) return null;
  const city = decodeHeader(headers.get("x-vercel-ip-city"));
  const regionRaw = headers.get("x-vercel-ip-country-region")?.trim();
  const state =
    regionRaw && /^[A-Za-z]{2}$/.test(regionRaw)
      ? regionRaw.toUpperCase()
      : null;
  return { zip: postal, city: city || null, state, approximate: true };
}

/** Round a coordinate to 2 decimals (about 1 km) before sending. */
export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

export const CENSUS_COORDS_URL =
  "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";

export function censusCoordsUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    x: String(lon),
    y: String(lat),
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    layers: "all",
    format: "json",
  });
  return `${CENSUS_COORDS_URL}?${params.toString()}`;
}

/**
 * TIGERweb query for a ZCTA's centroid, used only to turn a typed
 * ZIP into coordinates for the Census geographies lookup. Returns
 * geometry-free JSON.
 */
export function tigerZipCentroidUrl(zip: string): string {
  const params = new URLSearchParams({
    where: `ZCTA5='${zip}'`,
    outFields: "CENTLAT,CENTLON",
    returnGeometry: "false",
    f: "json",
  });
  return `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/2/query?${params.toString()}`;
}

function stripPlaceSuffix(name: string): string {
  return name
    .replace(/\s+(city|town|village|borough|CDP)$/i, "")
    .trim();
}

/**
 * Parse a Census geographies/coordinates response. Layer names were
 * checked live (2026-11-03): the ZIP lives under
 * "2020 Census ZIP Code Tabulation Areas" (field ZCTA5), the place
 * under "Incorporated Places" (BASENAME, e.g. "Chicago"; NAME is
 * "Chicago city") and the state under "States" (STUSAB, e.g. "IL").
 * Matching is by substring so a vintage rename still works.
 */
export function parseCensusGeographies(
  payload: unknown,
): { zip: string; city: string | null; state: string | null } | null {
  const geographies = (
    payload as {
      result?: { geographies?: Record<string, unknown> };
    } | null
  )?.result?.geographies;
  if (!geographies || typeof geographies !== "object") return null;
  let zip: string | null = null;
  let city: string | null = null;
  let state: string | null = null;
  for (const [key, value] of Object.entries(geographies)) {
    if (!Array.isArray(value) || value.length === 0) continue;
    const first = value[0] as Record<string, unknown>;
    const lower = key.toLowerCase();
    if (!zip && lower.includes("zip code tabulation")) {
      const candidate =
        (typeof first.ZCTA5 === "string" && first.ZCTA5) ||
        (typeof first.GEOID === "string" && first.GEOID) ||
        (typeof first.BASENAME === "string" && first.BASENAME) ||
        null;
      if (candidate && /^\d{5}$/.test(candidate)) zip = candidate;
    }
    if (!city && lower.includes("incorporated places")) {
      const basename =
        typeof first.BASENAME === "string" ? first.BASENAME.trim() : "";
      const name = typeof first.NAME === "string" ? first.NAME.trim() : "";
      city = basename || (name ? stripPlaceSuffix(name) : null);
      if (city === "") city = null;
    }
    if (!state && lower === "states") {
      const stusab =
        typeof first.STUSAB === "string" ? first.STUSAB.trim() : "";
      state = stusab ? stusab.toUpperCase() : null;
    }
  }
  if (!zip) return null;
  return { zip, city: city || null, state };
}

/** Parse a TIGERweb ZCTA centroid response, or null. */
export function parseTigerZipCentroid(
  payload: unknown,
): { lat: number; lon: number } | null {
  const features = (payload as { features?: unknown } | null)?.features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const attrs = (features[0] as { attributes?: Record<string, unknown> })
    ?.attributes;
  if (!attrs) return null;
  const lat = Number(attrs.CENTLAT);
  const lon = Number(attrs.CENTLON);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/** "Chicago, IL 60614", or just the ZIP when the place is unknown. */
export function areaPlaceLabel(area: SearchArea): string {
  if (area.city && area.state) return `${area.city}, ${area.state} ${area.zip}`;
  if (area.city) return `${area.city} ${area.zip}`;
  return area.zip;
}
