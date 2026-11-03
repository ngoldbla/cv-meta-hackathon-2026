"use client";

import { underwaterLabel } from "@/lib/summary";
import { MiniChart, type CurveLike } from "../WorthChart";

/**
 * UnderwaterMini (task 034): the existing task-026 mini chart,
 * wrapped as a catalog component. Data is ownership_math's curve.
 */
export function UnderwaterMiniView({
  evenMonth,
  curve,
}: {
  evenMonth: number | null;
  curve: CurveLike[];
}) {
  const label = underwaterLabel(evenMonth);
  return (
    <section
      aria-label={label}
      className="flex items-center gap-3 border-t border-border pt-3"
    >
      <div className="w-[120px] shrink-0">
        <MiniChart curve={curve} evenMonth={evenMonth} />
      </div>
      <div className="flex flex-col gap-[2px]">
        <span className="text-sm font-medium">{label}</span>
      </div>
    </section>
  );
}
