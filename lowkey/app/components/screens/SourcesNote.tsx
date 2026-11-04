"use client";

import { Button } from "@/components/ui/b-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/b-popover";
import type { Sources } from "@/lib/resultView";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-03" -> "Nov 3, 2026". */
function footerDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}, ${m[1]}`;
}

/** Sources and assumptions (task 038), from the search on screen. */
export function SourcesNote({ sources, summary, aprLabel }: { sources: Sources | null; summary: string; aprLabel: string | null }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className="min-h-11 text-xs underline underline-offset-2">
          Sources &amp; assumptions
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-[min(22rem,calc(100vw-2rem))] p-3 text-sm leading-relaxed">
        <div className="flex flex-col gap-2">
          <p>
            Payments use {summary}
            {aprLabel ? <> ({aprLabel})</> : null}. The down payment is a share of the price with fees. Change them
            under “Change” above the cars.
            {sources?.taxIncluded ? " Sales tax is financed in the loan." : ""} Insurance and repairs are extra.
          </p>
          {sources?.taxNotice ? <p>{sources.taxNotice}</p> : null}
          <p>“Keeps about N%” is what you&apos;d likely get selling after 5 years, as a share of the price.</p>
          {sources?.soldVehicles && sources.providerAsOf ? (
            <p>
              Rankings from {sources.soldVehicles.toLocaleString("en-US")} sold vehicles, as of{" "}
              {footerDate(sources.providerAsOf)} · Local stock live.
            </p>
          ) : null}
          {(sources?.lifespan ?? []).map(([source, asOf]) => (
            <p key={source}>
              Lifespan: {source}
              {asOf ? `, as of ${asOf}` : ""}.
            </p>
          ))}
          {(sources?.gas ?? []).map(([display, latest]) => (
            <p key={display}>
              Gas: {display}, as of {footerDate(latest)}.
            </p>
          ))}
          {sources && sources.gas.length > 0 ? (
            <p>
              MPG: EPA combined (55% city, 45% highway), matched to the local car where the listing allows; otherwise
              the model&apos;s typical figure, labelled.
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
