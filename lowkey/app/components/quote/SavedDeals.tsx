"use client";

import { Button } from "@/components/ui/b-button";
import { Typography } from "@/components/ui/typography";
import { removeDeal, starDeal, type SavedDeal } from "@/lib/deals";
import { dealTitle } from "@/lib/quote/benchmark";

/** The shopper's saved deals (task 059): open one, star the one to compare against, or remove it. */
export function SavedDeals({
  deals,
  activeId,
  onOpen,
}: {
  deals: SavedDeal[];
  activeId: string | null;
  onOpen: (d: SavedDeal) => void;
}) {
  if (!deals.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="Your deals">
      <Typography variant="label-md">Your deals</Typography>
      <Typography variant="paragraph-xs" className="text-muted-foreground">
        The starred deal (or the newest) is the one results and car pages compare against. Saved on this device only.
      </Typography>
      <ul className="flex flex-col">
        {deals.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-x-2 border-t border-border py-1">
            <div className="min-w-0 flex-1">
              <Typography variant="paragraph-sm" className="font-medium">
                {dealTitle(d.quote)}
                {d.starred ? " ★" : ""}
              </Typography>
              <Typography variant="paragraph-xs" className="text-muted-foreground">
                {[d.quote.dealerName, d.quote.statedMonthly !== null ? `$${Math.round(d.quote.statedMonthly)}/mo` : null]
                  .filter(Boolean)
                  .join(" · ") || "No dealer name"}
              </Typography>
            </div>
            <Button type="button" variant={d.id === activeId ? "secondary" : "ghost"} className="min-h-11" onClick={() => onOpen(d)}>
              Open
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" aria-pressed={d.starred} onClick={() => starDeal(d.id)}>
              {d.starred ? "Unstar" : "Star"}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => removeDeal(d.id)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
