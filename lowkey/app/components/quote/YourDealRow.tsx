"use client";

import Link from "next/link";

import type { QuotePick } from "@/components/QuoteCheck";
import { fmtUsd } from "@/components/render/format";
import { Typography } from "@/components/ui/typography";
import type { SavedDeal } from "@/lib/deals";
import { dealRowOf, dealTitle, resaleFor } from "@/lib/quote/benchmark";
import type { SameTerms } from "@/lib/quote/compare";

/** The saved deal as the benchmark above the picks (task 059). Tapping it opens the deal. */
export function YourDealRow({ deal, picks, terms }: { deal: SavedDeal; picks: QuotePick[]; terms: SameTerms }) {
  const q = deal.quote;
  const info = q.car ? { year: q.car.year, miles: q.car.miles, retention: deal.retention } : null;
  const row = dealRowOf(q, terms, resaleFor(q, info, picks, new Date().getFullYear()));
  const money =
    [
      row.monthly !== null ? `${fmtUsd(row.monthly)}/mo as quoted` : null,
      row.outTheDoor !== null ? `${fmtUsd(row.outTheDoor)} out the door` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Add the numbers to compare";
  return (
    <Link
      href={`/quote?deal=${encodeURIComponent(deal.id)}`}
      className="mt-2 flex min-h-11 flex-col gap-0.5 rounded-[10px] border border-border px-3 py-2 text-foreground no-underline hover:bg-muted"
      aria-label={`Your deal: ${dealTitle(q)}`}
    >
      <Typography variant="label-sm" className="text-muted-foreground">
        Your deal
      </Typography>
      <Typography variant="paragraph-md" className="font-medium">
        {dealTitle(q)}
        {q.dealerName ? <span className="font-normal text-muted-foreground"> · {q.dealerName}</span> : null}
      </Typography>
      <Typography variant="paragraph-sm" className="tabular-nums">
        {money}
      </Typography>
      {row.equityMonth !== null ? (
        <Typography variant="paragraph-xs" className="text-muted-foreground">
          Positive equity by month {row.equityMonth}
          {row.basis === "typical" ? " (typical resale)" : ""}
        </Typography>
      ) : null}
    </Link>
  );
}
