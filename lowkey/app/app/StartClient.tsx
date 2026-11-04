"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CarFigure } from "@/components/hairline/CarFigure";
import { AreaControl, loadStoredArea, persistArea } from "@/components/screens/AreaControl";
import { SiteHeader } from "@/components/screens/Chrome";
import { Button, buttonVariants } from "@/components/ui/b-button";
import { Typography } from "@/components/ui/typography";
import { areaAfterSearch, resolveInitialArea, type SearchArea } from "@/lib/geo";
import { resultsPath } from "@/lib/routes";
import { LAST_SEARCH_KEY, parseLastSearch, resumeHeading, type SavedSearch, type SearchType } from "@/lib/search";
import { DEFAULT_SORT } from "@/lib/chooser";

/** Task 054: one full-width tile per type, with one plain line about it (no figures). */
const TYPES: { label: string; kind: SearchType; line: string }[] = [
  { label: "Sedan", kind: "sedan", line: "Four doors and a trunk, for everyday driving." },
  { label: "SUV", kind: "suv", line: "Higher seats and more room for cargo." },
  { label: "Pickup", kind: "pickup", line: "An open bed for hauling and towing." },
  { label: "Minivan", kind: "minivan", line: "Sliding doors and three rows of seats." },
  { label: "Hybrid", kind: "hybrid", line: "Gas and electric together, in any body style." },
];

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const view = (zip: string) => ({
  zip,
  terms: { down: null, downPct: null, apr: null, term: null },
  sort: DEFAULT_SORT,
});

/**
 * The start screen (task 049, concept B; leaner in task 054): the area
 * and the five types as full-width tiles. One tap on a type opens its
 * lineup. The remembered last search is offered on the resume card and
 * runs only when tapped (task 041). Why Low Key works the way it does
 * lives in lowkey/docs/why-low-key.md and on the About page.
 */
export default function StartClient({ initialArea }: { initialArea: SearchArea | null }) {
  const router = useRouter();
  const [area, setArea] = useState<SearchArea | null>(initialArea);
  const [pending, setPending] = useState<SearchType | null>(null);
  const [resume, setResume] = useState<SavedSearch | null>(null);

  // Stored-area precedence (task 032, part 1): confirmed wins over the
  // header guess; unconfirmed yields to a fresh guess.
  useEffect(() => {
    const resolved = resolveInitialArea(loadStoredArea(), initialArea);
    if (resolved) setArea(resolved);
    setResume(parseLastSearch(read(LAST_SEARCH_KEY)));
  }, [initialArea]);

  function go(type: SearchType, a: SearchArea) {
    // Searching does not confirm a guessed area (task 032, part 1).
    persistArea(areaAfterSearch(a));
    router.push(resultsPath(type, view(a.zip)));
  }

  function pickType(type: SearchType) {
    if (area) go(type, area);
    else setPending(type);
  }

  function forget() {
    try {
      window.localStorage.removeItem(LAST_SEARCH_KEY);
    } catch {
      // Best-effort only.
    }
    setResume(null);
  }

  return (
    <main className="shell">
      <SiteHeader />
      <section className="mt-6 flex flex-col gap-2">
        <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance">Get a car without regret.</h1>
        <Typography variant="paragraph-md" className="text-muted-foreground">
          We help you buy for value and quality: the signal, not the noise.
        </Typography>
      </section>

      {resume ? (
        <section aria-label="Pick up where you left off" className="mt-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-1">
            <Typography variant="paragraph-md" className="font-medium">
              {resumeHeading(resume)}
            </Typography>
            <Typography variant="paragraph-sm" className="text-muted-foreground">
              Prices and stock are checked again when you tap.
            </Typography>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={resultsPath(resume.type, view(resume.zip))} className={buttonVariants({ className: "min-h-11" })}>
              Show them again
            </Link>
            <Button type="button" variant="ghost" onClick={forget} className="min-h-11 text-muted-foreground">
              Start fresh
            </Button>
          </div>
        </section>
      ) : null}

      <div className="mt-5">
        <AreaControl
          area={area}
          forceOpen={pending !== null && area === null}
          hint={pending ? "Your ZIP, so we can find cars nearby" : null}
          onArea={(next) => {
            setArea(next);
            if (pending) {
              const t = pending;
              setPending(null);
              go(t, next);
            }
          }}
        />
      </div>

      <nav aria-label="Car type" className="mt-4 flex flex-col gap-2">
        {TYPES.map(({ label, kind, line }) => (
          <button
            key={kind}
            type="button"
            aria-pressed={pending === kind}
            onClick={() => pickType(kind)}
            className="group flex min-h-[104px] w-full items-center gap-4 rounded-[14px] border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted aria-pressed:border-brass"
          >
            {/* The tile names the type; the drawing is decoration here. */}
            <span aria-hidden="true" className="w-[128px] shrink-0">
              <CarFigure kind={kind} className="w-full" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-lg font-semibold leading-tight">{label}</span>
              <span className="text-sm leading-snug text-muted-foreground">{line}</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5">
              <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </nav>

      <footer className="mt-auto flex items-center gap-3 py-4 text-xs">
        <Link href="/about" className="inline-flex min-h-11 items-center underline underline-offset-2">
          About
        </Link>
      </footer>
    </main>
  );
}
