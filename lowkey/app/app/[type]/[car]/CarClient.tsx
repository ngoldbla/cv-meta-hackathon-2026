"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { RenderSpec } from "@/components/render/registry";
import { TextFallback } from "@/components/render/TextFallback";
import { AppBar } from "@/components/screens/Chrome";
import { useSearch } from "@/components/screens/useSearch";
import WalkAwayView from "@/components/WalkAwayView";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/b-button";
import { Skeleton } from "@/components/ui/skeleton";
import { isCatalogValid } from "@/lib/render/validate";
import { carsOf, type CarView } from "@/lib/resultView";
import { listingPath, parseView, quotePath, resultsPath, searchApiQuery } from "@/lib/routes";
import type { SearchType } from "@/lib/search";

/** The walk-away view's inputs from one priced car (the same mapping the chat page used before task 049). */
function walkInputs(car: CarView) {
  const o = car.ownership!;
  const any = o as typeof o & { evenMonth?: number | null; underwaterMonth?: number | null; perMonth?: number };
  return {
    price: o.price,
    taxAmount: o.taxAmount,
    taxNotice: o.taxNotice,
    downPayment: o.downPayment,
    aprPercent: o.aprPercent,
    termMonths: o.termMonths,
    monthlyPayment: o.monthlyPayment,
    curve: o.curve ?? [],
    monthly: (o.monthly ?? []).map((p) => ({ month: p.month, getBack: p.getBack, costPerMonth: p.costPerMonth })),
    walkAway: o.walkAway.map((p) => ({
      month: p.month,
      getBack: p.getBack ?? 0,
      costPerMonth: p.costPerMonth ?? (p as { perMonth?: number }).perMonth ?? 0,
    })),
    positiveEquityMonth: o.positiveEquityMonth ?? any.evenMonth ?? any.underwaterMonth ?? null,
  };
}

/** One car (task 049, concept B): its card, its walk-away and its listings. */
export default function CarClient({ type, slug }: { type: SearchType; slug: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const view = parseView(params);
  const state = useSearch(view ? searchApiQuery(type, view) : null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    if (!view) router.replace("/");
  }, [view, router]);

  const data = state.status === "ready" ? state.data : null;
  const car = useMemo(() => (data ? carsOf(data).find((c) => c.slug === slug) ?? null : null), [data, slug]);
  if (!view) return null;

  const back = resultsPath(type, view);
  const title = car ? `${car.pick.make} ${car.pick.model}` : "This car";
  const spec = car && data ? data.cards.find((c) => c.model === car.pick.model)?.spec ?? null : null;
  const openListing = (_model: string, url: string) => {
    const n = (car?.entry.local?.units ?? []).findIndex((u) => u.url === url);
    if (car && n >= 0) router.push(listingPath(type, car.slug, n + 1, view));
  };

  return (
    <main className="shell pb-24">
      <AppBar title={title} fallback={back} />
      {state.status === "loading" ? (
        <div className="flex flex-col gap-3 py-4" aria-busy="true">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : state.status === "error" || !car ? (
        <div className="flex flex-col gap-3 py-4">
          <Alert
            appearance="destructive"
            timeout={0}
            dismissible={false}
            width="100%"
            message={state.status === "error" ? "Couldn't load this car just now. Please try again." : "This car isn't in the lineup for this search."}
          />
          <Link href={back} className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
            See the lineup
          </Link>
        </div>
      ) : (
        <>
          <div className="pt-3">
            {spec && isCatalogValid(spec) ? (
              <RenderSpec spec={spec} onListing={openListing} resultsUrl={origin + back} />
            ) : (
              <TextFallback entry={car.entry} peers={data!.shown as never} category={data!.category} />
            )}
          </div>
          {car.ownership ? (
            <section id="walk-away" aria-labelledby="walk-away-title" className="mt-6 scroll-mt-16">
              <h2 id="walk-away-title" className="text-lg font-semibold">
                If you change your mind
              </h2>
              <WalkAwayView
                hideHeader
                pick={car.pick as never}
                ownership={walkInputs(car)}
                aprText={car.ownership.aprLabel ?? `${car.ownership.aprPercent}% APR`}
                onBack={() => router.push(back)}
              />
            </section>
          ) : null}
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background">
            <div className="mx-auto flex max-w-[720px] gap-2 px-4 py-3">
              <Link href={quotePath({ type, view, car: car.slug })} className={buttonVariants({ className: "min-h-11 flex-1" })}>
                Compare my quote with this car
              </Link>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
