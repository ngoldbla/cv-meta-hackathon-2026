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
import { WalkAwayContext } from "./walk-context";

const KIND_BY_CATEGORY: Record<string, CarKind> = {
  Sedan: "sedan",
  SUV: "suv",
  Pickup: "pickup",
};

/**
 * PickCard (task 034): the container. Badge, in-stock dot, Hairline
 * figure, model and trim, sentence, trim-step line, then its
 * children in the mockup's order (CostBars, LifespanTrack,
 * EquityMini, DealerLine), then "If I change my mind".
 */
export function PickCardView({
  badgeLabel,
  modelLabel,
  sentence,
  trimLine,
  inStock,
  category,
  modelKey,
  hasWalkAway,
  children,
}: {
  rank: number | null;
  badgeLabel: string;
  modelLabel: string;
  sentence: string;
  trimLine: string | null;
  inStock: boolean;
  category: string;
  modelKey: string;
  hasWalkAway: boolean;
  children?: ReactNode;
}) {
  const { onWalkAway } = useContext(WalkAwayContext);
  const cheapest = badgeLabel.toLowerCase().includes("cheapest");
  const kind = KIND_BY_CATEGORY[category];
  return (
    <Card className="my-3">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <Badge color={cheapest ? "amber" : "gray"} shimmer={false}>
            {badgeLabel}
          </Badge>
          {inStock ? (
            <StatusDot tone="success" showLabel label="In stock" size="sm" />
          ) : null}
        </div>
        <div className="flex items-start gap-3">
          {kind ? (
            <div className="h-24 w-[120px] shrink-0 overflow-hidden">
              <CarFigure kind={kind} />
            </div>
          ) : null}
          <div className="min-w-0">
            <CardTitle className="text-[19px]">{modelLabel}</CardTitle>
            <CardDescription>{sentence}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {trimLine ? (
          <p className="mb-3 text-sm leading-relaxed text-foreground/80">{trimLine}</p>
        ) : null}
        <div className="flex flex-col gap-3">{children}</div>
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
