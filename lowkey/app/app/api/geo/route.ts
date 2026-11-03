import {
  censusCoordsUrl,
  lookupWithRetry,
  parseCensusGeographies,
  parseTigerZipCentroid,
  roundCoord,
  tigerZipCentroidUrl,
} from "@/lib/geo";

export const maxDuration = 30;

type GeoOut = { zip: string | null; city: string | null; state: string | null };

const EMPTY: GeoOut = { zip: null, city: null, state: null };

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

async function censusPlaceOnce(lat: number, lon: number): Promise<GeoOut> {
  const payload = await fetchJson(censusCoordsUrl(lat, lon));
  if (!payload) return EMPTY;
  const parsed = parseCensusGeographies(payload);
  if (!parsed) return EMPTY;
  return parsed;
}

/**
 * Census geographies with one quiet retry (task 032, part 2).
 * Report 030's cold 30097 bare ZIP came through this call: warm
 * probes of both upstreams return Duluth, GA, and the route can
 * only answer with a bare ZIP from here when the Census fetch or
 * its place layer comes back empty, so the retry belongs here.
 * The client retry re-runs the whole lookup, TIGERweb included.
 */
async function censusPlaceWithRetry(
  lat: number,
  lon: number,
): Promise<GeoOut> {
  const result = await lookupWithRetry(() => censusPlaceOnce(lat, lon));
  return result ?? EMPTY;
}

async function fromCoords(lat: number, lon: number): Promise<GeoOut> {
  // User coordinates are rounded again server-side so the raw
  // values never leave here.
  return censusPlaceWithRetry(roundCoord(lat), roundCoord(lon));
}

async function fromCentroid(lat: number, lon: number): Promise<GeoOut> {
  // A ZCTA centroid is public data, not a user's location, so it
  // is sent unrounded: rounding it can cross a place boundary.
  return censusPlaceWithRetry(lat, lon);
}

/**
 * Search-area lookup (task 030, part 1). Returns only
 * {zip, city, state}: coordinates (already rounded by the client,
 * rounded again here) become a ZIP via the Census geocoder, and a
 * typed ZIP becomes a place via its TIGERweb centroid and the same
 * Census call. Coordinates are never logged or stored.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const zipParam = params.get("zip");
  if (zipParam !== null) {
    const zip = zipParam.trim();
    if (!/^\d{5}$/.test(zip)) {
      return Response.json(EMPTY, { status: 400 });
    }
    const centroidPayload = await fetchJson(tigerZipCentroidUrl(zip));
    const centroid = centroidPayload
      ? parseTigerZipCentroid(centroidPayload)
      : null;
    if (!centroid) return Response.json({ zip, city: null, state: null });
    const place = await fromCentroid(centroid.lat, centroid.lon);
    if (!place.zip) return Response.json({ zip, city: null, state: null });
    return Response.json({ zip, city: place.city, state: place.state });
  }
  const latRaw = params.get("lat");
  const lonRaw = params.get("lon");
  if (latRaw === null || lonRaw === null) {
    return Response.json(EMPTY, { status: 400 });
  }
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json(EMPTY, { status: 400 });
  }
  return Response.json(await fromCoords(lat, lon));
}
