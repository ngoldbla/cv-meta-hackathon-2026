"use client";

import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/b-collapsible";
import { fmtUsd } from "./format";

export interface DealerUnitView {
  title: string;
  miles: number;
  price: number;
  dealer: string;
  url: string;
  note: string | null;
}

function UnitLine({ unit }: { unit: DealerUnitView }) {
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
      <a
        href={unit.url}
        target="_blank"
        rel="noreferrer"
        className="inline-block py-[13px] -my-[13px]"
      >
        See the car
      </a>
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
}: {
  face: DealerUnitView | null;
  more: DealerUnitView[];
  error: string | null;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreLabel = more.length > 0 ? `${more.length} more nearby` : null;
  return (
    <section className="flex flex-col gap-1 border-t border-border pt-3 text-[13px]">
      {error ? (
        <span>{error}</span>
      ) : face ? (
        <ul className="flex flex-col gap-1.5">
          <UnitLine unit={face} />
        </ul>
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
