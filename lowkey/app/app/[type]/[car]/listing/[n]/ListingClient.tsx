"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { RenderSpec } from "@/components/render/registry";
import { AppBar } from "@/components/screens/Chrome";
import { useSearch } from "@/components/screens/useSearch";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/b-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Typography } from "@/components/ui/typography";
import { checkListingSpec } from "@/lib/render/guard";
import { buildListingSpec } from "@/lib/render/specs";
import { isCatalogValid } from "@/lib/render/validate";
import { carsOf } from "@/lib/resultView";
import { carPath, parseView, quotePath, resultsPath, searchApiQuery } from "@/lib/routes";
import type { SearchType } from "@/lib/search";

/** One local unit and its deal sheet (tasks 041, 049), before the dealer's site. */
export default function ListingClient({ type, slug, n }: { type: SearchType; slug: string; n: number }) {
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

  const unit = car?.entry.local?.units?.[n - 1] ?? null;
  const back = carPath(type, slug, view);
  const spec = car && unit ? buildListingSpec(car.entry, unit.url) : null;
  const ok = Boolean(spec && isCatalogValid(spec) && checkListingSpec(spec, car!.entry).ok);
  if (spec && !ok) console.error("lowkey: dropped a render spec that failed the number guard");
  const props = (ok && spec ? spec.elements[spec.root]?.props : null) as { title: string } | null;
  const title = props?.title ?? (car ? `${car.pick.make} ${car.pick.model}` : "Listing");

  return (
    <main className="shell">
      <AppBar title={car ? `${car.pick.make} ${car.pick.model}` : "Listing"} fallback={back} />
      {state.status === "loading" ? (
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
            <h2 className="text-xl font-semibold tracking-[-0.01em]">{title}</h2>
            <Typography variant="paragraph-sm" className="text-muted-foreground">
              {unit.dealer} · {Math.round(unit.distanceMiles)} mi away
            </Typography>
          </div>
          {ok && spec ? (
            <RenderSpec spec={spec} resultsUrl={origin + resultsPath(type, view)} />
          ) : (
            <a href={unit.url} target="_blank" rel="noopener noreferrer" className="inline-block min-h-11 py-3 underline">
              Open the dealer&apos;s listing (opens the dealer&apos;s site)
            </a>
          )}
          <Link href={quotePath({ type, view, car: slug })} className={buttonVariants({ variant: "outline", className: "min-h-11" })}>
            Check this dealer&apos;s quote
          </Link>
        </div>
      )}
    </main>
  );
}
