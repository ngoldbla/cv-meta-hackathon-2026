"use client";

import { lastsAboutLabel } from "@/lib/costs";

/**
 * LifespanTrack (task 034): a 0-20 year track (widened past 20 when
 * a lifespan exceeds it), dark for the loan years and gold after,
 * with a marker at the lifespan. Unrated: an empty track and
 * "Lifespan: not yet rated", no number.
 */
export function LifespanTrackView({
  years,
  loanYears,
  miles,
}: {
  years: number | null;
  loanYears: number;
  miles: number | null;
  source: string | null;
}) {
  if (years === null) {
    return (
      <section aria-label="Lifespan: not yet rated" className="flex flex-col gap-[5px] border-t border-border pt-3">
        <span className="text-sm font-medium">Lifespan: not yet rated</span>
        <div className="relative h-[22px]" aria-hidden="true">
          <div className="absolute inset-x-0 top-[9px] h-1 rounded-sm bg-[var(--cost-track)]" />
        </div>
        <div className="mono flex justify-between text-[11px] text-muted-foreground">
          <span>0</span>
          <span>20 yrs</span>
        </div>
      </section>
    );
  }
  const max = Math.max(20, Math.ceil(years));
  const loanPct = (Math.min(loanYears, max) / max) * 100;
  const markerPct = (years / max) * 100;
  const goldWidth = Math.max(0, markerPct - loanPct);
  const milesText =
    miles === null
      ? null
      : `about ${(Math.round(miles / 1000) * 1000).toLocaleString("en-US")} miles`;
  const label = lastsAboutLabel(years);
  return (
    <section aria-label={label} className="flex flex-col gap-[5px] border-t border-border pt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        {milesText ? <span className="text-xs text-muted-foreground">{milesText}</span> : null}
      </div>
      <div className="relative h-[22px]" aria-hidden="true">
        <div className="absolute inset-x-0 top-[9px] h-1 rounded-sm bg-[var(--cost-track)]" />
        <div
          className="absolute top-[9px] h-1 rounded-sm bg-[var(--cost-loan)]"
          style={{ left: 0, width: `${loanPct}%` }}
        />
        <div
          className="absolute top-[9px] h-1 bg-[var(--cost-gas)]"
          style={{ left: `${loanPct}%`, width: `${goldWidth}%` }}
        />
        <div
          className="absolute top-1 h-[14px] w-[14px] rounded-full border-2 border-[var(--cost-lost)] bg-card"
          style={{ left: `calc(${markerPct}% - 7px)` }}
        />
      </div>
      <div className="mono flex justify-between text-[11px] text-muted-foreground">
        <span>0</span>
        <span>{loanYears} yrs: loan paid</span>
        <span>{max} yrs</span>
      </div>
      <span className="text-xs text-muted-foreground">
        Dark: while you pay it off. Gold: years after that with no car payment.
      </span>
    </section>
  );
}
