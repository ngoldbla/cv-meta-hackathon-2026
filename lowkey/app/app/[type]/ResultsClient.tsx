"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

import { RenderSpec } from "@/components/render/registry";
import { TextFallback } from "@/components/render/TextFallback";
import { AppBar } from "@/components/screens/Chrome";
import { YearsToggle } from "@/components/screens/PriceContext";
import { SourcesNote } from "@/components/screens/SourcesNote";
import { TermsScreen } from "@/components/screens/TermsScreen";
import { useSearch } from "@/components/screens/useSearch";
import { YourDealRow } from "@/components/quote/YourDealRow";
import { useDeals } from "@/components/quote/useDeals";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/b-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Typography } from "@/components/ui/typography";
import { benchmark } from "@/lib/deals";
import { isCatalogValid } from "@/lib/render/validate";
import { carsOf, quotePicksOf, sourcesOf } from "@/lib/resultView";
import {
  carPath,
  listingPath,
  parseView,
  quotePath,
  resultsPath,
  searchApiQuery,
  termsPath,
  termsSummary,
  withYears,
  type View,
} from "@/lib/routes";
import { LAST_SEARCH_KEY, resumeHeading, serializeLastSearch, typeLabel, type SearchType } from "@/lib/search";
import type { SortKey } from "@/lib/chooser";

const PLURAL: Record<SearchType, string> = { sedan: "Sedans", suv: "SUVs", pickup: "Pickups", minivan: "Minivans", hybrid: "Hybrids" };

function remember(type: SearchType, zip: string) {
  try {
    window.localStorage.setItem(LAST_SEARCH_KEY, serializeLastSearch({ type, zip }));
    window.localStorage.setItem("lowkey-searched", "1");
  } catch {
    // Best-effort only.
  }
}

function SlidersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="10" cy="17" r="2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** The results screen (task 049, concept B): one row per car on one cost scale. */
export default function ResultsClient({ type }: { type: SearchType }) {
  const router = useRouter();
  const params = useSearchParams();
  const view = parseView(params);
  const termsOpen = params.get("terms") === "1";
  const api = view ? searchApiQuery(type, view) : null;
  const state = useSearch(api);

  useEffect(() => {
    if (!view) router.replace("/");
  }, [view, router]);

  useEffect(() => {
    if (state.status === "ready" && view) remember(type, view.zip);
  }, [state.status, type, view]);

  const data = state.status === "ready" ? state.data : null;
  const cars = useMemo(() => (data ? carsOf(data) : []), [data]);
  const sources = useMemo(() => (data ? sourcesOf(data) : null), [data]);
  // Task 059: the saved deal is the benchmark above the lineup.
  const { deals } = useDeals();
  const mine = benchmark(deals);
  const picks = useMemo(() => (data ? quotePicksOf(data) : []), [data]);
  if (!view) return null;

  const v: View = view;
  const summary = termsSummary(v.terms, data?.aprPercent ?? null);
  const slugOf = (model: string) => cars.find((c) => c.pick.model === model)?.slug ?? null;
  const openCar = (model: string) => {
    const slug = slugOf(model);
    if (slug) router.push(carPath(type, slug, v));
  };
  const openListing = (model: string, url: string) => {
    const car = cars.find((c) => c.pick.model === model);
    const n = (car?.entry.local?.units ?? []).findIndex((u) => u.url === url);
    if (car && n >= 0) router.push(listingPath(type, car.slug, n + 1, v));
  };
  const compare = data?.compare && isCatalogValid(data.compare) ? data.compare : null;

  if (termsOpen) {
    return (
      <TermsScreen
        terms={v.terms}
        aprPercent={data?.aprLabel ? data.aprPercent : null}
        aprLabel={data?.aprLabel ?? null}
        fallback={resultsPath(type, v)}
        onDone={(terms) => router.replace(resultsPath(type, { ...v, terms }))}
      />
    );
  }

  return (
    <main className="shell">
      <AppBar
        title={`${PLURAL[type]} near ${v.zip}`}
        fallback="/"
        right={
          <Link href={quotePath({ type, view: v })} className="min-h-11 content-center whitespace-nowrap rounded-full px-2 text-sm font-medium text-foreground no-underline hover:bg-muted">
            Got the VIN?
          </Link>
        }
      />

      <div className="flex min-h-11 items-center gap-2 text-sm">
        <SlidersIcon />
        <span className="tabular-nums">
          {summary}
          {sources?.taxIncluded ? " · tax incl." : ""}
        </span>
        <span className="flex-1" />
        <Button
          type="button"
          variant="link"
          linkUnderline="static"
          className="min-h-11 underline underline-offset-2"
          onClick={() => router.push(termsPath(type, v))}
        >
          Change
        </Button>
      </div>

      <YearsToggle allYears={v.years === "all"} onToggle={(all) => router.replace(resultsPath(type, withYears(v, all)), { scroll: false })} />

      {mine && data ? (
        <YourDealRow
          deal={mine}
          picks={picks}
          terms={{ downRule: data.downRule, aprPercent: data.aprPercent, termMonths: data.termMonths }}
        />
      ) : null}

      <section aria-label={resumeHeading({ type, zip: v.zip })} aria-busy={state.status === "loading"} className="mt-1">
        {state.status === "loading" ? (
          <div className="flex flex-col gap-3">
            <Typography variant="paragraph-sm" role="status" className="text-muted-foreground">
              Finding {typeLabel(type) === "SUV" ? "SUVs" : `${typeLabel(type).toLowerCase()}s`} near {v.zip} and working out what each costs…
            </Typography>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2 border-b border-border py-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-5/6" />
              </div>
            ))}
          </div>
        ) : state.status === "error" ? (
          <div className="flex flex-col gap-3 py-3">
            <Alert
              appearance="destructive"
              timeout={0}
              dismissible={false}
              width="100%"
              message={state.message === "invalid" ? "That search link isn't complete. Start again from the types." : "Couldn't load the cars just now. Please try again."}
            />
            <div className="flex gap-2">
              <Button type="button" className="min-h-11" onClick={() => window.location.reload()}>
                Try again
              </Button>
              <Link href="/" className="inline-flex min-h-11 items-center px-2 text-sm underline underline-offset-2">
                Start again
              </Link>
            </div>
          </div>
        ) : compare ? (
          <RenderSpec
            spec={compare}
            sort={v.sort}
            onSort={(key: SortKey) => router.replace(resultsPath(type, { ...v, sort: key }), { scroll: false })}
            onOpen={openCar}
          />
        ) : (
          // Fewer than two comparable cars, or a chooser that failed the
          // guard: each card shows on its own, unnumbered (task 040).
          <div className="flex flex-col gap-3">
            {cars.map((c) => {
              const spec = data?.cards.find((x) => x.model === c.pick.model)?.spec;
              return spec && isCatalogValid(spec) ? (
                <RenderSpec key={c.slug} spec={spec} onWalkAway={openCar} onListing={openListing} />
              ) : (
                <TextFallback
                  key={c.slug}
                  entry={c.entry}
                  peers={data!.shown as never}
                  category={data!.category}
                  onWalkAway={() => openCar(c.pick.model)}
                />
              );
            })}
          </div>
        )}
      </section>

      <footer className="mt-auto flex flex-wrap items-center gap-x-2 border-t border-border py-3">
        <SourcesNote sources={sources} summary={summary} aprLabel={data?.aprLabel ?? null} />
        <Link href="/about" className="inline-flex min-h-11 items-center text-xs underline underline-offset-2">
          About
        </Link>
      </footer>

    </main>
  );
}
