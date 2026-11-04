"use client";

import { useState } from "react";

import { fmtUsd } from "@/components/render/format";
import { groupUnits, type DealerUnitView } from "@/components/render/DealerLine";
import { RenderSpec } from "@/components/render/registry";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/b-collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { unitTitle } from "@/lib/costs";
import { checkFarLeads, checkPriceStripSpec } from "@/lib/render/guard";
import { buildPriceStripSpec, type SpecEntry, type StripUnit } from "@/lib/render/specs";
import { isCatalogValid } from "@/lib/render/validate";
import { fartherApiQuery } from "@/lib/routes";
import type { SearchType } from "@/lib/search";
import type { LocalUnit } from "@/lib/listings";

import { useFarther } from "./useFarther";

/** The price strip for one unit, guarded before it renders (task 054). */
export function PriceStripFor({ entry, unit }: { entry: SpecEntry; unit: StripUnit | null }) {
  if (!unit) return null;
  const spec = buildPriceStripSpec(entry, unit);
  if (!spec) return null;
  if (!isCatalogValid(spec) || !checkPriceStripSpec(spec, entry, unit).ok) {
    console.error("lowkey: dropped a render spec that failed the number guard");
    return null;
  }
  return <RenderSpec spec={spec} />;
}

export type FarLead = LocalUnit & { saves: number };

const LINK = "inline-flex min-h-11 items-center text-[13px] font-medium text-brass underline underline-offset-[3px]";

/**
 * "Better prices farther away" (task 054, part 2): closed until asked;
 * opening it makes the one on-demand national search for this car.
 * Prices only: travel, delivery and the shopper's own state's taxes
 * and fees are not included, and travel is never estimated.
 */
export function FartherLeads({
  type,
  slug,
  zip,
  model,
  make,
  chosenVin,
  startOpen,
  allYears = false,
  onOpen,
  onChoose,
}: {
  type: SearchType;
  slug: string;
  zip: string;
  model: string;
  make: string;
  chosenVin: string | null;
  /** Open on arrival (a shared link that chose a far-away unit). */
  startOpen: boolean;
  /** Task 054: the search includes older model years. */
  allYears?: boolean;
  onOpen: (vin: string) => void;
  onChoose: (vin: string | null) => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const state = useFarther(open ? fartherApiQuery(type, slug, zip, allYears) : null);
  const data = state.status === "ready" ? state.data : null;
  const leads = data ? checkFarLeads(data.leads, data.bestLocal, data.radius, data.margin) : [];
  if (data && leads.length !== data.leads.length) console.error("lowkey: dropped a far-away lead that failed the number guard");
  const views: (DealerUnitView & { lead: FarLead })[] = leads.map((u) => ({
    title: unitTitle(u.year, model, u.trim),
    miles: u.distanceMiles,
    price: u.price,
    dealer: u.dealer,
    url: u.url,
    note: null,
    vin: u.vin,
    chosen: u.vin === chosenVin,
    lead: u,
  }));
  const groups = groupUnits(views) as (DealerUnitView & { lead: FarLead })[][];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b-0 overflow-visible">
      <CollapsibleTrigger className="min-h-11 justify-start gap-1 py-2 text-sm font-medium text-brass underline underline-offset-[3px] [&>span]:flex-none">
        Better prices farther away
      </CollapsibleTrigger>
      <CollapsibleContent contentClassName="space-y-0 pr-0 pb-1 text-foreground [&_ul]:list-none [&_ul]:pl-0">
        {state.status === "loading" ? (
          <div className="flex flex-col gap-2 py-2" aria-busy="true">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : state.status === "error" || (data && data.error) ? (
          <p className="py-2 text-sm text-muted-foreground">Couldn&apos;t search farther away just now.</p>
        ) : data ? (
          <div className="flex flex-col gap-3 pt-1">
            <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
              {data.year ? `${data.year} ` : ""}
              {make} {model}
              {data.trim ? ` ${data.trim}` : ""} listed beyond {data.radius} miles for at least {fmtUsd(data.margin ?? 0)} less
              than the lowest price nearby ({fmtUsd(data.bestLocal ?? 0)}).
            </p>
            {groups.length === 0 ? (
              <p className="text-sm">None listed for that much less right now.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {groups.map((g) => {
                  const u = g[0]!;
                  const place = [u.lead.city, u.lead.state].filter(Boolean).join(", ");
                  return (
                    <li key={u.url} className="flex flex-col gap-0.5 text-[13px] leading-relaxed">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 font-medium">{u.title}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{fmtUsd(u.price)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        {g.length > 1 ? `${g.length} at ` : ""}
                        {u.dealer}
                        {place ? `, ${place}` : ""} · <span className="tabular-nums">{Math.round(u.miles)} mi away</span>
                      </span>
                      <span>
                        <span className="tabular-nums">{fmtUsd(u.lead.saves)}</span> less than the lowest price nearby
                        {g.some((x) => x.chosen) ? <span className="font-medium"> · The one you&apos;re going for</span> : null}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-4">
                        {g.map((x, i) => (
                          <button
                            key={x.url}
                            type="button"
                            className={LINK}
                            aria-label={`${g.length > 1 ? `See car ${i + 1} of ${g.length}, the` : "See the"} ${x.title} at ${x.dealer}${place ? ` in ${place}` : ""}`}
                            onClick={() => onOpen(x.vin!)}
                          >
                            {g.length > 1 ? `See car ${i + 1}` : "See the car"}
                          </button>
                        ))}
                        {g.some((x) => x.chosen) ? (
                          <button type="button" className={LINK} onClick={() => onChoose(null)}>
                            Go back to the cheapest nearby
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={LINK}
                            aria-label={`Go for the ${u.title} at ${u.dealer}`}
                            onClick={() => onChoose(u.vin!)}
                          >
                            {g.length > 1 ? "Go for one of these" : "Go for this one"}
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Prices as listed. Travel, delivery, and your own state&apos;s taxes and fees are not included.
            </p>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Task 054: model years stay fixed (each car's newest) unless the shopper
 * widens the search to older model years that are still new.
 */
export function YearsToggle({
  allYears,
  onToggle,
  year = null,
  fellBack = false,
}: {
  allYears: boolean;
  onToggle: (all: boolean) => void;
  /** On a car's screen: the model year its search used. */
  year?: number | null;
  /** The newest year had no stock within 150 miles, so the year before was searched. */
  fellBack?: boolean;
}) {
  const note = allYears
    ? "Including older model years that are still new."
    : year !== null
      ? fellBack
        ? `No ${year + 1} models in stock within 150 miles, so these are ${year} models.`
        : `${year} models only.`
      : "Each car's newest model year only.";
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      <span>{note}</span>
      <button
        type="button"
        onClick={() => onToggle(!allYears)}
        className="inline-flex min-h-11 items-center font-medium text-brass underline underline-offset-[3px]"
      >
        {allYears ? "Newest model year only" : "Include older model years, still new"}
      </button>
    </p>
  );
}
