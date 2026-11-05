/**
 * The share card's monthly figure (task 060). The figure is read from the
 * same guard-checked pick-card spec the page shows; it is shown only when
 * that spec passes the number guard. The model writes nothing here.
 */
import type { Spec } from "@json-render/core";

import { checkPickCardSpec } from "./render/guard";
import type { SpecEntry } from "./render/specs";

export interface ShareCost {
  /** Whole dollars a month, the card's "real cost" total. */
  realMonthly: number;
}

/** The monthly cost from a card spec, or null when the spec fails the guard or has no cost bar. */
export function shareCostFromCard(spec: Spec, entry: SpecEntry): ShareCost | null {
  if (!checkPickCardSpec(spec, entry).ok) return null;
  for (const el of Object.values(spec.elements)) {
    if (el.type !== "CostBars") continue;
    const total = (el.props as { realTotal?: unknown }).realTotal;
    if (typeof total === "number" && Number.isFinite(total) && total > 0) return { realMonthly: total };
  }
  return null;
}

/**
 * Where an image route may read a cost from. It must read only what is
 * already cached and never call the listings provider. No cache-only read
 * exists in this app yet (see report 060), so the default source finds
 * nothing and the card stays words-only.
 */
export type ShareCostSource = (args: { type: string; slug: string; zip: string }) => Promise<ShareCost | null>;

export const noCachedCost: ShareCostSource = async () => null;

export function usdLabel(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")} a month`;
}
