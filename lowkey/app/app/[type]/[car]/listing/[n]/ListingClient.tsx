"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { RenderSpec } from "@/components/render/registry";
import { AppBar } from "@/components/screens/Chrome";
import { PriceStripFor } from "@/components/screens/PriceContext";
import { useFarther } from "@/components/screens/useFarther";
import { useSearch } from "@/components/screens/useSearch";
import { Button } from "@/components/ui/b-button";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/b-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Typography } from "@/components/ui/typography";
import { checkFarLeads, checkListingSpec } from "@/lib/render/guard";
import { buildListingSpec, stripUnitOf, type SpecUnit } from "@/lib/render/specs";
import { isCatalogValid } from "@/lib/render/validate";
import { carsOf } from "@/lib/resultView";
import { carPath, fartherApiQuery, listingPath, parseView, quotePath, resultsPath, searchApiQuery, withChoice } from "@/lib/routes";
import type { SearchType } from "@/lib/search";

/** One local unit and its deal sheet (tasks 041, 049), before the dealer's site. */
export default function ListingClient({ type, slug, n }: { type: SearchType; slug: string; n: number | string }) {
  const router = useRouter();
  const params = useSearchParams();
  const view = parseView(params, slug);
  const state = useSearch(view ? searchApiQuery(type, view) : null, { keep: true });
  const farVin = typeof n === "string" ? n : null;
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    if (!view) router.replace("/");
  }, [view, router]);

  const data = state.status === "ready" ? state.data : null;
  const car = useMemo(() => (data ? carsOf(data).find((c) => c.slug === slug) ?? null : null), [data, slug]);
  if (!view) return null;

  return <ListingBody type={type} slug={slug} n={n} farVin={farVin} view={view} state={state} car={car} origin={origin} />;
}

function ListingBody({
  type,
  slug,
  n,
  farVin,
  view,
  state,
  car,
  origin,
}: {
  type: SearchType;
  slug: string;
  n: number | string;
  farVin: string | null;
  view: NonNullable<ReturnType<typeof parseView>>;
  state: ReturnType<typeof useSearch>;
  car: ReturnType<typeof carsOf>[number] | null;
  origin: string;
}) {
  const router = useRouter();
  // Task 054: a far-away unit is the chosen one, or one of the leads (on demand).
  const chosenFar = farVin && car?.entry.chosen?.vin === farVin ? car.entry.chosen.unit : null;
  const far = useFarther(farVin && car && !chosenFar ? fartherApiQuery(type, slug, view.zip, view.years === "all") : null);
  const farData = far.status === "ready" ? far.data : null;
  const leads: SpecUnit[] = farData ? checkFarLeads(farData.leads, farData.bestLocal, farData.radius, farData.margin) : [];
  const unit: SpecUnit | null =
    typeof n === "number"
      ? (car?.entry.local?.units?.[n - 1] ?? null)
      : (chosenFar ?? leads.find((u) => u.vin === farVin) ?? null);
  const back = carPath(type, slug, view);
  const spec = car && unit ? buildListingSpec(car.entry, unit.url, leads) : null;
  const ok = Boolean(spec && isCatalogValid(spec) && checkListingSpec(spec, car!.entry, leads).ok);
  if (spec && !ok) console.error("lowkey: dropped a render spec that failed the number guard");
  const props = (ok && spec ? spec.elements[spec.root]?.props : null) as { title: string } | null;
  const chosenVin = view.choice?.car === slug ? view.choice.unit : null;
  // Task 054, part 3: in the URL, so Back undoes it.
  const choose = (vin: string | null) =>
    router.push(listingPath(type, slug, n, withChoice(view, vin ? { car: slug, unit: vin } : null)), { scroll: false });
  const title = props?.title ?? (car ? `${car.pick.make} ${car.pick.model}` : "Listing");

  return (
    <main className="shell">
      <AppBar title={car ? `${car.pick.make} ${car.pick.model}` : "Listing"} fallback={back} titleAs={car && unit ? "p" : "h1"} />
      {state.status === "loading" || (farVin && !unit && far.status !== "ready" && far.status !== "error" && !chosenFar && car) ? (
        <div className="flex flex-col gap-3 py-4" aria-busy="true">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : !car || !unit ? (
        <div className="flex flex-col gap-3 py-4">
          <Alert
            appearance="destructive"
            timeout={0}
            dismissible={false}
            width="100%"
            message={state.status === "error" ? "Couldn't load this listing just now. Please try again." : "This listing isn't in the search any more."}
          />
          <Link href={resultsPath(type, view)} className="inline-flex min-h-11 items-center text-sm underline underline-offset-2">
            See the lineup
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4 py-4">
          <div>
            <h1 className="text-2xl leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
            <Typography variant="paragraph-sm" className="text-muted-foreground">
              {unit.dealer}
              {farVin && (unit.city || unit.state) ? `, ${[unit.city, unit.state].filter(Boolean).join(", ")}` : ""} ·{" "}
              {Math.round(unit.distanceMiles)} mi away
            </Typography>
          </div>
          {unit.vin ? (
            chosenVin === unit.vin ? (
              <div className="flex flex-col gap-1 rounded-[10px] bg-muted px-3 py-2">
                <p className="text-sm font-medium">This is the one you&apos;re going for. The car&apos;s figures are priced on it.</p>
                <Button type="button" variant="ghost" className="min-h-11 self-start px-0 underline underline-offset-2" onClick={() => choose(null)}>
                  Go back to the cheapest nearby
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="min-h-11" onClick={() => choose(unit.vin!)}>
                This is the one I&apos;m going for
              </Button>
            )
          ) : null}
          {farVin ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Far from you. Travel, delivery, and your own state&apos;s taxes and fees are not included in the listed price.
            </p>
          ) : null}
          {ok && spec ? (
            <RenderSpec spec={spec} resultsUrl={origin + resultsPath(type, view)} />
          ) : (
            <a href={unit.url} target="_blank" rel="noopener noreferrer" className="inline-block min-h-11 py-3 underline">
              Open the dealer&apos;s listing (opens the dealer&apos;s site)
            </a>
          )}
          <PriceStripFor entry={car.entry} unit={stripUnitOf(unit)} />
          <Link href={quotePath({ type, view, car: slug })} className={buttonVariants({ variant: "outline", className: "min-h-11" })}>
            Check this dealer&apos;s quote
          </Link>
        </div>
      )}
    </main>
  );
}
