"use client";

import {
  positiveEquityLabel,
  yoursAt5YearsLabel,
} from "@/lib/summary";
import { EquityMiniChart, equityOf, type CurveLike } from "../WorthChart";

/**
 * EquityMini (task 039): one rising equity line on the card.
 * Both lines of text come from tool results: the positive-equity
 * month and the equity at month 60.
 */
export function EquityMiniView({
  positiveEquityMonth,
  curve,
}: {
  positiveEquityMonth: number | null;
  curve: CurveLike[];
}) {
  const label = positiveEquityLabel(positiveEquityMonth);
  const at60 = curve.find((p) => p.month === 60) ?? curve[curve.length - 1];
  const equityAt60 = at60 ? equityOf(at60) : 0;
  const showYours = positiveEquityMonth !== null && at60 !== undefined;
  return (
    <section
      aria-label={label}
      className="flex items-center gap-3 border-t border-border pt-3"
    >
      <div className="w-[120px] shrink-0">
        <EquityMiniChart curve={curve} positiveEquityMonth={positiveEquityMonth} />
      </div>
      <div className="flex flex-col gap-[2px]">
        <span className="text-sm font-medium">{label}</span>
        {showYours ? (
          <span className="text-sm text-muted-foreground">
            {yoursAt5YearsLabel(equityAt60)}
          </span>
        ) : null}
      </div>
    </section>
  );
}
