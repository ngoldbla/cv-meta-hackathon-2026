"use client";

import { useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/b-button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Typography } from "@/components/ui/typography";
import {
  areaPlaceLabel,
  confirmArea,
  lookupWithRetry,
  parseStoredArea,
  serializeStoredArea,
  STILL_LOOKING_AFTER_MS,
  type GeoLookupResult,
  type SearchArea,
} from "@/lib/geo";

export const AREA_STORAGE_KEY = "lowkey-area";
const GEO_ERROR = "Couldn't get your location. Type a ZIP instead.";

export function loadStoredArea(): SearchArea | null {
  try {
    return parseStoredArea(window.localStorage.getItem(AREA_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function persistArea(next: SearchArea) {
  try {
    window.localStorage.setItem(AREA_STORAGE_KEY, serializeStoredArea(next));
  } catch {
    // Storage is best-effort only (task 030, part 1).
  }
}

async function lookup(query: string): Promise<GeoLookupResult | null> {
  // A bare or failed lookup retries once (task 032, part 2).
  return lookupWithRetry(async () => {
    const res = await fetch(`/api/geo?${query}`);
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as GeoLookupResult | null;
  });
}

/**
 * The search area (tasks 030, 032, 034): the approximate area from the
 * request, a typed ZIP, or "Use my location". Moved out of the chat page
 * in task 049; the behaviour is unchanged.
 */
export function AreaControl({
  area,
  onArea,
  forceOpen = false,
  hint,
}: {
  area: SearchArea | null;
  onArea: (next: SearchArea) => void;
  /** Open the ZIP field (a type was tapped before any area was known). */
  forceOpen?: boolean;
  hint?: string | null;
}) {
  const [open, setOpen] = useState(area === null);
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [forceOpen]);

  useEffect(() => {
    if (area && !forceOpen) setOpen(false);
  }, [area, forceOpen]);

  // "Still looking…" after 3 s of a location lookup (task 034).
  useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), STILL_LOOKING_AFTER_MS);
    return () => clearTimeout(t);
  }, [busy]);

  function apply(next: SearchArea) {
    const confirmed = confirmArea(next);
    persistArea(confirmed);
    setOpen(false);
    setZip("");
    setError(null);
    onArea(confirmed);
  }

  function useLocation() {
    if (busy) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError(GEO_ERROR);
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        void (async () => {
          try {
            const data = await lookup(`lat=${lat}&lon=${lon}`);
            if (data?.zip && /^\d{5}$/.test(data.zip)) {
              apply({ zip: data.zip, city: data.city ?? null, state: data.state ?? null });
            } else {
              setError(GEO_ERROR); // the current area stays as it was
            }
          } catch {
            setError(GEO_ERROR);
          } finally {
            setBusy(false);
          }
        })();
      },
      () => {
        setError(GEO_ERROR);
        setBusy(false);
      },
      { timeout: 8000 },
    );
  }

  async function submit(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const z = zip.trim();
    if (!/^\d{5}$/.test(z) || busy) return;
    setBusy(true);
    setError(null);
    try {
      // A second bare result still confirms the typed ZIP alone.
      const data = await lookup(`zip=${z}`);
      apply({ zip: z, city: data?.city ?? null, state: data?.state ?? null });
    } catch {
      apply({ zip: z, city: null, state: null });
    } finally {
      setBusy(false);
    }
  }

  const locating = (
    <>
      <Spinner size="sm" /> Locating…
    </>
  );

  return (
    <div>
      {open ? (
        <div>
          <Typography variant="paragraph-md" className="font-medium">
            {area ? `Searching near ${areaPlaceLabel(area)}` : "Where are you shopping?"}
          </Typography>
          <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => void submit(e)}>
            <label className="sr-only" htmlFor="lowkey-zip">
              ZIP code
            </label>
            <div className="w-32">
              <Input
                id="lowkey-zip"
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="ZIP code"
                aria-label="ZIP code"
                maxLength={5}
                value={zip}
                disabled={busy}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                className="min-h-11"
              />
            </div>
            <Button type="submit" disabled={busy || zip.trim().length !== 5} className="min-h-11">
              Use this ZIP
            </Button>
            {area ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)} className="min-h-11">
                Cancel
              </Button>
            ) : null}
          </form>
          <Button type="button" variant="outline" disabled={busy} onClick={useLocation} className="mt-2 min-h-11">
            {busy ? locating : "Use my location"}
          </Button>
          {hint && !area ? (
            <Typography variant="paragraph-sm" className="mt-2 text-muted-foreground">
              {hint}
            </Typography>
          ) : null}
        </div>
      ) : area ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span>
            Near <strong>{areaPlaceLabel(area)}</strong>
            {area.approximate ? " (approximate)" : ""}
          </span>
          <span aria-hidden="true">·</span>
          <Button
            type="button"
            variant="link"
            linkUnderline="static"
            disabled={busy}
            onClick={() => {
              setZip(area.zip);
              setError(null);
              setOpen(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            className="min-h-11 underline underline-offset-2"
          >
            Change
          </Button>
          <span aria-hidden="true">·</span>
          <Button
            type="button"
            variant="link"
            linkUnderline="static"
            disabled={busy}
            onClick={useLocation}
            className="min-h-11 underline underline-offset-2"
          >
            {busy ? locating : "Use my location"}
          </Button>
        </div>
      ) : null}
      {busy && slow ? (
        <p role="status" className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size="sm" /> Still looking…
        </p>
      ) : null}
      {error ? (
        <Alert appearance="destructive" timeout={0} dismissible={false} width="100%" message={error} className="mt-2" />
      ) : null}
    </div>
  );
}
