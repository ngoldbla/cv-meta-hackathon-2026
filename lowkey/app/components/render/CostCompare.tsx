"use client";

import { motion } from "motion/react";
import { useContext, useId } from "react";

import { Badge } from "@/components/ui/badge";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/b-togglegroup";
import { categoryNoun } from "@/lib/categories";
import { SORT_KEYS, SORT_LABEL, isSortKey, sortFacts } from "@/lib/chooser";

import { ChooserContext } from "./chooser-context";
import { SEGMENT_COLOR, fmtUsd } from "./format";

export interface CostCompareRow {
  label: string;
  model: string;
  trim: string | null;
  labels: string[];
  valueLost: number;
  interest: number;
  gas: number;
  tax: number;
  total: number;
  bills: number;
  nearestMiles: number | null;
  lifespanYears: number | null;
  price: number | null;
  listingTotal: number | null;
}


/** One short fact line per row: bills, distance, lifespan. */
function factLine(r: CostCompareRow): string {
  const parts = [`You pay ${fmtUsd(r.bills)}/mo`];
  if (r.nearestMiles !== null) parts.push(`${Math.round(r.nearestMiles)} mi away`);
  parts.push(
    r.lifespanYears !== null
      ? `lasts about ${Math.round(r.lifespanYears)} yrs`
      : "lifespan not yet rated",
  );
  return parts.join(" · ");
}

/**
 * The chooser (task 040; was the comparison from tasks 034–038).
 * Every car shown is one Low Key stands behind, so the order is the
 * shopper's: a "Sort by" control (Real cost · Monthly · Nearest ·
 * Lasts longest) re-orders the rows, which move gently (and not at
 * all under reduced motion, via the page's MotionConfig). No rank
 * numbers; each row carries its best-at labels. The bars keep one
 * shared scale whatever the order. Tapping a row opens the car's
 * full card in a sheet. Each row's aria-label reads its numbers;
 * the totals are printed, so nothing relies on colour alone.
 */
export function CostCompareView({
  category,
  rows,
}: {
  category: string;
  rows: CostCompareRow[];
}) {
  const { sort, onSort, onOpen } = useContext(ChooserContext);
  const sortLabelId = useId();
  const ordered = sortFacts(rows, sort);
  const max = Math.max(...rows.map((r) => r.total), 1);
  const pct = (n: number) => `${(n / max) * 100}%`;
  const rowAria = (r: CostCompareRow) =>
    `${r.label}${r.labels.length ? `, ${r.labels.join(", ").toLowerCase()}` : ""}: ${r.total} dollars a month real cost: ${r.valueLost} value lost, ${r.interest} interest, ${r.gas} gas, ${r.tax} sales tax; you pay ${r.bills} dollars a month${r.nearestMiles !== null ? `; nearest ${Math.round(r.nearestMiles)} miles` : ""}${r.price !== null && r.listingTotal !== null ? `; lowest listed ${r.price} dollars of ${r.listingTotal} listed` : ""}${onOpen ? ". Opens the full card." : ""}`;
  return (
    <section
      aria-label={`What each ${categoryNoun(category)} really costs a month, sorted by ${SORT_LABEL[sort].toLowerCase()}`}
      className="my-3 flex flex-col gap-3 rounded-[14px] border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-[2px]">
        <span className="text-base font-semibold">What each one really costs a month</span>
        <span className="text-xs text-muted-foreground">
          Over 5 years, after resale. Tap a car for its full card.
        </span>
      </div>
      {onSort ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground" id={sortLabelId}>
            Sort by
          </span>
          <ToggleGroup
            aria-labelledby={sortLabelId}
            variant="outline"
            multiple={false}
            value={[sort]}
            onValueChange={(next) => {
              const picked = next[0];
              if (isSortKey(picked)) onSort(picked);
            }}
            className="w-full"
          >
            {SORT_KEYS.map((key) => (
              <ToggleGroupItem
                key={key}
                value={key}
                className="h-auto min-h-11 flex-1 px-1 py-2 text-xs leading-tight"
              >
                {SORT_LABEL[key]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}
      <ul className="flex flex-col gap-1">
        {ordered.map((r) => (
          <motion.li
            key={r.model}
            layout="position"
            transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <button
              type="button"
              aria-label={rowAria(r)}
              disabled={!onOpen}
              onClick={() => onOpen?.(r.model)}
              className="flex w-full flex-col gap-1.5 rounded-[10px] px-2 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted disabled:cursor-default"
            >
              <span className="flex w-full items-baseline justify-between gap-3">
                <span className="min-w-0 text-[15px] font-medium leading-snug">
                  {r.label}
                  {r.trim ? (
                    <span className="font-normal text-muted-foreground"> {r.trim}</span>
                  ) : null}
                </span>
                <span className="mono shrink-0 text-[15px] font-semibold">
                  {fmtUsd(r.total)}
                  <span className="text-xs font-normal text-muted-foreground">/mo</span>
                </span>
              </span>
              {r.labels.length ? (
                <span className="flex flex-wrap gap-1">
                  {r.labels.map((l) => (
                    <Badge
                      key={l}
                      color={l === "Cheapest to own" ? "amber" : "gray"}
                      size="sm"
                      animate={false}
                      shimmer={false}
                    >
                      {l}
                    </Badge>
                  ))}
                </span>
              ) : null}
              <span aria-hidden="true" className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px] bg-card">
                <span style={{ width: pct(r.valueLost), minWidth: r.valueLost > 0 ? 2 : undefined, background: SEGMENT_COLOR.valueLost }} className="block h-full" />
                <span style={{ width: pct(r.interest), minWidth: r.interest > 0 ? 2 : undefined, background: SEGMENT_COLOR.interest }} className="block h-full" />
                <span style={{ width: pct(r.gas), minWidth: r.gas > 0 ? 2 : undefined, background: SEGMENT_COLOR.gas }} className="block h-full" />
                <span style={{ width: pct(r.tax), minWidth: r.tax > 0 ? 2 : undefined, background: SEGMENT_COLOR.tax }} className="block h-full" />
              </span>
              <span className="text-xs text-muted-foreground">{factLine(r)}</span>
              {r.price !== null && r.listingTotal !== null ? (
                <span className="text-xs text-muted-foreground">
                  {fmtUsd(r.price)} · lowest of {r.listingTotal} listed
                </span>
              ) : null}
            </button>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
