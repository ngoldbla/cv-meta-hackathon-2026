"use client";

import { useContext, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/b-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { CarFigure } from "../hairline/CarFigure";
import type { CarKind } from "@/lib/hairline/cars";
import { CardModelContext } from "./listing-context";
import { CardHeadingContext } from "./heading-context";
import { WalkAwayContext } from "./walk-context";

const KIND_BY_CATEGORY: Record<string, CarKind> = {
  Sedan: "sedan",
  SUV: "suv",
  Pickup: "pickup",
  Minivan: "minivan",
  Hybrid: "hybrid",
};

/**
 * PickCard (task 034): the container. Best-at labels (task 040; no
 * rank numbers), in-stock dot, Hairline
 * figure, model and trim, sentence, trim-step line, then its
 * children in the mockup's order (CostBars, LifespanTrack,
 * EquityMini, DealerLine), then "If I change my mind".
 */
export function PickCardView({
  labels,
  modelLabel,
  sentence,
  trimLine,
  inStock,
  category,
  modelKey,
  hasWalkAway,
  chosenNote = null,
  children,
}: {
  labels: string[];
  modelLabel: string;
  sentence: string;
  trimLine: string | null;
  inStock: boolean;
  category: string;
  modelKey: string;
  hasWalkAway: boolean;
  /** Task 054: "Priced on the car you're going for, at …". */
  chosenNote?: string | null;
  children?: ReactNode;
}) {
  const { onWalkAway } = useContext(WalkAwayContext);
  const heading = useContext(CardHeadingContext);
  const kind = KIND_BY_CATEGORY[category];
  return (
    <Card className="my-3">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 flex-wrap gap-1">
            {labels.map((l) => (
              <Badge
                key={l}
                color={l === "Cheapest to own" ? "brass" : "gray"}
                shimmer={false}
              >
                {l}
              </Badge>
            ))}
          </span>
          {inStock ? (
            <span className="shrink-0 whitespace-nowrap">
              <StatusDot tone="success" showLabel label="In stock" size="sm" />
            </span>
          ) : null}
        </div>
        <div className="flex items-start gap-3">
          {kind ? (
            <div className="h-24 w-[120px] shrink-0 overflow-hidden">
              <CarFigure kind={kind} />
            </div>
          ) : null}
          <div className="min-w-0">
            <CardTitle as={heading} className={heading === "h1" ? "text-2xl leading-tight" : "text-xl leading-tight"}>
              {modelLabel}
            </CardTitle>
            <CardDescription className="text-pretty">{sentence}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chosenNote ? (
          <p className="mb-3 rounded-[10px] bg-muted px-3 py-2 text-sm leading-relaxed">{chosenNote}</p>
        ) : null}
        {trimLine ? (
          <p className="mb-3 text-sm leading-relaxed text-foreground/80">{trimLine}</p>
        ) : null}
        <CardModelContext.Provider value={modelKey}>
          <div className="flex flex-col gap-3">{children}</div>
        </CardModelContext.Provider>
        {hasWalkAway && onWalkAway ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11 w-full"
            onClick={() => onWalkAway(modelKey)}
          >
            If I change my mind
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
