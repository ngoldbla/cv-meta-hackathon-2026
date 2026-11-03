"use client";

import { SEGMENT_COLOR, fmtUsd } from "./format";

export interface CostCompareRow {
  label: string;
  valueLost: number;
  interest: number;
  gas: number;
  total: number;
  highlighted: boolean;
}

function categoryNoun(category: string): string {
  return category === "SUV" ? "SUV" : category.toLowerCase();
}

/**
 * CostCompare (task 034): one segmented bar per pick on a shared
 * scale, cheapest to own first, the shown (first ranked) pick's row
 * in bold. The aria-label reads every row's numbers; the legend
 * names the segments and each row carries its total, so nothing is
 * conveyed by colour alone.
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
          `${r.label}: ${r.total} dollars a month: ${r.valueLost} value lost, ${r.interest} interest, ${r.gas} gas`,
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
            className={`grid grid-cols-[96px_1fr_44px] items-center gap-2 text-[13px] ${r.highlighted ? "font-semibold" : ""}`}
          >
            <span className="truncate">{r.label}</span>
            <div className="flex h-4 overflow-hidden rounded-[5px] bg-background" aria-hidden="true">
              <span style={{ width: pct(r.valueLost), background: SEGMENT_COLOR.valueLost }} className="block h-full" />
              <span style={{ width: pct(r.interest), background: SEGMENT_COLOR.interest }} className="block h-full" />
              <span style={{ width: pct(r.gas), background: SEGMENT_COLOR.gas }} className="block h-full" />
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
