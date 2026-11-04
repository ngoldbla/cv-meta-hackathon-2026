"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CarFigure } from "@/components/hairline/CarFigure";
import { CreditBlock, CREDIT_POINTS } from "@/components/CreditBlock";
import { AreaControl, loadStoredArea, persistArea } from "@/components/screens/AreaControl";
import { SiteHeader } from "@/components/screens/Chrome";
import { Button, buttonVariants } from "@/components/ui/b-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/b-popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/b-togglegroup";
import { Typography } from "@/components/ui/typography";
import { areaAfterSearch, resolveInitialArea, type SearchArea } from "@/lib/geo";
import { resultsPath } from "@/lib/routes";
import { LAST_SEARCH_KEY, parseLastSearch, resumeHeading, type SavedSearch, type SearchType } from "@/lib/search";
import { DEFAULT_SORT } from "@/lib/chooser";

const SEARCHED_STORAGE_KEY = "lowkey-searched";

const TYPES: [string, SearchType][] = [
  ["Sedan", "sedan"],
  ["SUV", "suv"],
  ["Pickup", "pickup"],
  ["Minivan", "minivan"],
  ["Hybrid", "hybrid"],
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
 * The start screen (task 049, concept B): the area and the five types.
 * One tap on a type opens its lineup. The remembered last search is
 * offered on the resume card and runs only when tapped (task 041).
 */
export default function StartClient({ initialArea }: { initialArea: SearchArea | null }) {
  const router = useRouter();
  const [area, setArea] = useState<SearchArea | null>(initialArea);
  const [pending, setPending] = useState<SearchType | null>(null);
  const [resume, setResume] = useState<SavedSearch | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);

  // Stored-area precedence (task 032, part 1): confirmed wins over the
  // header guess; unconfirmed yields to a fresh guess.
  useEffect(() => {
    const resolved = resolveInitialArea(loadStoredArea(), initialArea);
    if (resolved) setArea(resolved);
    setResume(parseLastSearch(read(LAST_SEARCH_KEY)));
    // First visit: how Low Key works is open. After a search: shut.
    setCreditOpen(read(SEARCHED_STORAGE_KEY) !== "1");
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

      <ToggleGroup
        aria-label="Car type"
        variant="outline"
        multiple={false}
        value={pending ? [TYPES.find(([, t]) => t === pending)![0]] : []}
        onValueChange={(next) => {
          const picked = TYPES.find(([label]) => label === next[0]);
          if (picked) pickType(picked[1]);
        }}
        // Task 042: five types in a 3 + 2 grid that fits 390 px.
        className="mt-3 grid w-full grid-cols-3 gap-2"
      >
        {TYPES.map(([label, kind]) => (
          <ToggleGroupItem key={kind} value={label} className="h-auto min-h-11 w-full rounded-md px-1 py-2">
            <span className="flex flex-col items-center gap-1">
              <CarFigure kind={kind} className="w-[96px] max-w-full" />
              <span>{label}</span>
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="mt-1 flex justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" className="min-h-11 shrink-0 text-xs underline underline-offset-2">
              Why no photos?
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-[min(20rem,calc(100vw-2rem))] p-3 text-sm leading-relaxed">
            <strong className="font-semibold">{CREDIT_POINTS[4]!.lead}</strong> {CREDIT_POINTS[4]!.text}
          </PopoverContent>
        </Popover>
      </div>

      <div className="mt-2 rounded-xl border border-border bg-card px-5 pb-4">
        <CreditBlock open={creditOpen} onOpenChange={setCreditOpen} />
        <Typography variant="paragraph-sm" className="mt-2 text-muted-foreground">
          No ads · No sign-up · Not paid by dealers.
        </Typography>
      </div>

      <footer className="mt-auto flex items-center gap-3 py-4 text-xs">
        <Link href="/about" className="inline-flex min-h-11 items-center underline underline-offset-2">
          About
        </Link>
      </footer>
    </main>
  );
}
