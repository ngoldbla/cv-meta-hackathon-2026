"use client";

import { useContext, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/b-collapsible";
import { fmtUsd } from "./format";
import { CardModelContext, ListingContext } from "./listing-context";

export interface DealerUnitView {
  title: string;
  miles: number;
  price: number;
  dealer: string;
  url: string;
  note: string | null;
  /** Task 054: the unit the shopper is going for. */
  chosen?: boolean;
  vin?: string | null;
}

/**
 * Identical units at one dealer, one price and one distance (task 054):
 * shown once, "3 at Nalley Honda", each still opening on its own.
 */
export function groupUnits(units: readonly DealerUnitView[]): DealerUnitView[][] {
  const groups: DealerUnitView[][] = [];
  const at = new Map<string, DealerUnitView[]>();
  for (const u of units) {
    const key = `${u.title}|${u.dealer}|${u.price}|${u.miles}|${u.note ?? ""}`;
    const g = at.get(key);
    if (g) g.push(u);
    else {
      const fresh = [u];
      at.set(key, fresh);
      groups.push(fresh);
    }
  }
  return groups;
}

const LINK = "inline-flex min-h-11 items-center text-[13px] font-medium text-brass underline underline-offset-[3px]";

function UnitGroup({ group }: { group: DealerUnitView[] }) {
  // Task 041: "See the car" opens the in-app listing sheet first; the
  // dealer's site is the sheet's last action. Without a handler (or a
  // card to belong to) it stays a plain new-tab link.
  const { onListing, onChoose } = useContext(ListingContext);
  const modelKey = useContext(CardModelContext);
  const first = group[0]!;
  const chosen = group.find((u) => u.chosen) ?? null;
  const open = (u: DealerUnitView, label: string, aria: string) =>
    onListing && modelKey ? (
      <button key={u.url} type="button" onClick={() => onListing(modelKey, u.url)} aria-label={aria} className={LINK}>
        {label}
      </button>
    ) : (
      <a key={u.url} href={u.url} target="_blank" rel="noopener noreferrer" aria-label={aria} className={LINK}>
        {label}
      </a>
    );
  const where = group.length > 1 ? `${group.length} at ${first.dealer}` : first.dealer;
  return (
    <li className="flex flex-col gap-0.5 text-[13px] leading-relaxed">
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 font-medium">{first.title}</span>
        <span className="shrink-0 font-semibold tabular-nums">{fmtUsd(first.price)}</span>
      </span>
      <span className="text-muted-foreground">
        {where} · <span className="tabular-nums">{first.miles} mi</span>
        {chosen ? <span className="font-medium text-foreground"> · The one you&apos;re going for</span> : null}
      </span>
      {first.note ? <span className="text-foreground/80">{first.note}</span> : null}
      <span className="flex flex-wrap items-center gap-x-4">
        {group.length === 1
          ? open(first, "See the car", `See the ${first.title} at ${first.dealer}`)
          : group.map((u, i) => open(u, `See car ${i + 1}`, `See car ${i + 1} of ${group.length}, the ${u.title} at ${u.dealer}`))}
        {onChoose && modelKey && first.vin ? (
          chosen ? (
            <button type="button" onClick={() => onChoose(modelKey, null)} className={LINK}>
              Go back to the cheapest
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onChoose(modelKey, first.vin!)}
              aria-label={`Go for the ${first.title} at ${first.dealer}`}
              className={LINK}
            >
              {group.length > 1 ? "Go for one of these" : "Go for this one"}
            </button>
          )
        ) : null}
      </span>
    </li>
  );
}

/**
 * DealerLine (task 034): the task-033 cheapest unit plus the
 * "N more nearby" collapsible, wrapped as a catalog component.
 */
export function DealerLineView({
  face,
  more,
  error,
  listingTotal,
  listingRadius,
  listingMax,
}: {
  face: DealerUnitView | null;
  more: DealerUnitView[];
  error: string | null;
  listingTotal: number | null;
  listingRadius: number | null;
  listingMax: number | null;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  // Task 054: identical units fold into the face's row.
  const groups = face ? groupUnits([face, ...more]) : [];
  const faceGroup = groups[0] ?? [];
  const restGroups = groups.slice(1);
  const restCount = restGroups.reduce((n, g) => n + g.length, 0);
  const moreLabel = restCount > 0 ? `${restCount} more nearby` : null;
  // Task 038: where the face price sits among local listings. The
  // range appears only when every listing is already returned.
  const position =
    face && listingTotal !== null
      ? `Lowest of ${listingTotal} listed${listingRadius !== null ? ` within ${listingRadius} mi` : ""}${listingMax !== null && listingMax > face.price ? ` · listed ${fmtUsd(face.price)}–${fmtUsd(listingMax)}` : ""}`
      : null;
  return (
    <section className="flex flex-col gap-1 border-t border-border pt-3 text-[13px]">
      {error ? (
        <span>{error}</span>
      ) : face ? (
        <>
          <ul className="flex flex-col gap-1.5">
            <UnitGroup group={faceGroup} />
          </ul>
          {position ? (
            <span className="text-xs text-muted-foreground">{position}</span>
          ) : null}
        </>
      ) : (
        <span>No local stock found. Payment uses the typical price.</span>
      )}
      {face && moreLabel ? (
        <Collapsible
          open={moreOpen}
          onOpenChange={setMoreOpen}
          className="border-b-0 overflow-visible"
        >
          <CollapsibleTrigger className="min-h-11 justify-start gap-1 py-2 font-semibold text-brass underline underline-offset-[3px] [&>span]:flex-none [&>span]:text-[13px] [&>span]:leading-5">
            {moreOpen ? "Show less" : moreLabel}
          </CollapsibleTrigger>
          <CollapsibleContent contentClassName="space-y-0 pr-0 pb-1 [&_ul]:list-none [&_ul]:pl-0 [&_a]:no-underline">
            <ul className="flex flex-col gap-3 pt-1">
              {restGroups.map((g) => (
                <UnitGroup key={g[0]!.url} group={g} />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  );
}
