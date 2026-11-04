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
}

function UnitLine({ unit }: { unit: DealerUnitView }) {
  // Task 041: "See the car" opens the in-app listing sheet first; the
  // dealer's site is the sheet's last action. Without a handler (or a
  // card to belong to) it stays a plain new-tab link.
  const { onListing } = useContext(ListingContext);
  const modelKey = useContext(CardModelContext);
  return (
    <li className="text-[13px] leading-relaxed">
      <span className="mono font-semibold">{unit.miles} mi</span>
      {" · "}
      <span className="font-medium">{unit.title}</span>
      {" · "}
      <span className="mono">{fmtUsd(unit.price)}</span>
      {" · "}
      {unit.dealer}
      {" · "}
      {onListing && modelKey ? (
        <button
          type="button"
          onClick={() => onListing(modelKey, unit.url)}
          aria-label={`See the ${unit.title} at ${unit.dealer}`}
          className="inline-block -my-[13px] py-[13px] text-brass underline"
        >
          See the car
        </button>
      ) : (
        <a
          href={unit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block py-[13px] -my-[13px]"
        >
          See the car
        </a>
      )}
      {unit.note ? (
        <span className="mt-1 block text-foreground/80">{unit.note}</span>
      ) : null}
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
  const moreLabel = more.length > 0 ? `${more.length} more nearby` : null;
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
            <UnitLine unit={face} />
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
            <ul className="flex flex-col gap-1.5 pt-1">
              {more.map((unit) => (
                <UnitLine key={unit.url} unit={unit} />
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  );
}
