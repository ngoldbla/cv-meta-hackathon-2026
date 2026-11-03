"use client";

import { Badge } from "@/components/ui/badge";

import { SEGMENT_COLOR, fmtUsd } from "./format";

export interface CostCompareRow {
  label: string;
  valueLost: number;
  interest: number;
  gas: number;
  total: number;
  highlighted: boolean;
  cheapest: boolean;
}

function categoryNoun(category: string): string {
  return category === "SUV" ? "SUV" : category.toLowerCase();
}

/**
 * CostCompare (task 034; task 035 adds the tag): one segmented bar
 * per pick on a shared scale, cheapest to own first, the shown
 * (first ranked) pick's row in bold, and a "cheapest to own" badge
 * on every lowest-cost row (all of them on a tie). Names wrap, and
 * the badge wraps under the name when the row is narrow. The
 * aria-label reads every row's numbers and names the cheapest
 * rows; the legend names the segments and each row carries its
 * total, so nothing is conveyed by colour alone. Task 036: the
 * three segments are separated by 2 px card-colour gaps (flex gap
 * over a card background, gaps out of the track width via flex
 * shrink, positive segments at least 2 px wide).
 */
export function CostCompareView({
  category,
  rows,
}: {
  category: string;
  rows: CostCompareRow[];
}) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  const pct = (n: number) => `${(n / max) * 100}%`;
  const aria =
    `What each ${categoryNoun(category)} really costs a month. ` +
    rows
      .map(
        (r) =>
          `${r.label}${r.cheapest ? ", cheapest to own" : ""}: ${r.total} dollars a month: ${r.valueLost} value lost, ${r.interest} interest, ${r.gas} gas`,
      )
      .join(". ") +
    ".";
  return (
    <section
      aria-label={aria}
      className="my-3 flex flex-col gap-3 rounded-[14px] border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-[2px]">
        <span className="text-base font-semibold">What each one really costs a month</span>
        <span className="text-xs text-muted-foreground">
          Over 5 years, after you sell it. Shortest bar is cheapest to own.
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`grid grid-cols-[104px_1fr_44px] items-center gap-2 text-[13px] ${r.highlighted ? "font-semibold" : ""}`}
          >
            <span className="flex min-w-0 flex-wrap items-center gap-1">
              <span className="leading-tight">{r.label}</span>
              {r.cheapest ? (
                <Badge color="amber" size="sm" animate={false} shimmer={false}>
                  cheapest to own
                </Badge>
              ) : null}
            </span>
            <div className="flex h-4 gap-[2px] overflow-hidden rounded-[5px] bg-card" aria-hidden="true">
              <span style={{ width: pct(r.valueLost), minWidth: r.valueLost > 0 ? 2 : undefined, background: SEGMENT_COLOR.valueLost }} className="block h-full" />
              <span style={{ width: pct(r.interest), minWidth: r.interest > 0 ? 2 : undefined, background: SEGMENT_COLOR.interest }} className="block h-full" />
              <span style={{ width: pct(r.gas), minWidth: r.gas > 0 ? 2 : undefined, background: SEGMENT_COLOR.gas }} className="block h-full" />
            </div>
            <span className="mono text-right">{fmtUsd(r.total)}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-foreground/80">
        <span className="inline-flex items-center gap-[5px]">
          <span aria-hidden="true" className="inline-block h-[10px] w-[10px] rounded-[2px]" style={{ background: SEGMENT_COLOR.valueLost }} />
          Value it loses
        </span>
        <span className="inline-flex items-center gap-[5px]">
          <span aria-hidden="true" className="inline-block h-[10px] w-[10px] rounded-[2px]" style={{ background: SEGMENT_COLOR.interest }} />
          Loan interest
        </span>
        <span className="inline-flex items-center gap-[5px]">
          <span aria-hidden="true" className="inline-block h-[10px] w-[10px] rounded-[2px]" style={{ background: SEGMENT_COLOR.gas }} />
          Gas
        </span>
      </div>
    </section>
  );
}
