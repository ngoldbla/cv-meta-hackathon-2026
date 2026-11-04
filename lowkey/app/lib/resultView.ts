/**
 * One search result, as the screens read it (task 049). Ported from the
 * chat page's per-turn code: the same spec entries, the same card keys,
 * the same quote picks and the same sources footer, now from
 * `GET /api/search` instead of streamed tool parts.
 */

import type { QuotePick } from "@/components/QuoteCheck";
import type { SearchResult } from "./searchRun";
import { pickSlug, type SpecEntry, type SpecOwnership } from "./render/specs";

type Pick0 = SearchResult["shown"][number];
type Own0 = SearchResult["ownerships"][number];

/** Card key: the table model, tolerant of a "Make Model" echo. */
export function modelKey(model: string, make?: string | null): string {
  const bare = model.trim().toLowerCase();
  if (make) {
    const prefix = `${make.trim().toLowerCase()} `;
    if (bare.startsWith(prefix)) return bare.slice(prefix.length);
  }
  return bare;
}

/** Tool output -> spec-builder ownership (task 034). */
export function toSpecOwnership(o: Own0 | undefined): SpecOwnership | undefined {
  if (!o) return undefined;
  const any = o as Own0 & { evenMonth?: number | null; underwaterMonth?: number | null };
  return {
    price: o.price,
    taxAmount: o.taxAmount,
    taxStatus: o.taxStatus,
    taxNotice: o.taxNotice,
    downPayment: o.downPayment,
    loanAmount: o.loanAmount ?? o.price + (o.taxAmount ?? 0) - o.downPayment,
    monthlyPayment: o.monthlyPayment,
    aprPercent: o.aprPercent,
    termMonths: o.termMonths,
    positiveEquityMonth: o.positiveEquityMonth ?? any.evenMonth ?? any.underwaterMonth ?? null,
    evenMonth: any.evenMonth ?? any.underwaterMonth ?? null,
    underwaterMonth: any.underwaterMonth ?? null,
    curve: (o.curve ?? []) as SpecOwnership["curve"],
    dealInputs: o.dealInputs,
  } as SpecOwnership;
}

export interface CarView {
  slug: string;
  pick: Pick0;
  ownership: Own0 | undefined;
  entry: SpecEntry;
}

/** The lineup's cars in lineup order, with the commodity flag applied as on the cards. */
export function carsOf(r: SearchResult): CarView[] {
  const commodity = r.rank.commodity;
  return r.shown.map((p, i) => {
    const pick = {
      ...p,
      flag: commodity && p.model === commodity.model ? commodity.flag : (p as { flag?: "badge" | "extra" }).flag,
    } as Pick0;
    const ownership = r.ownerships[i];
    return {
      slug: pickSlug(pick),
      pick,
      ownership,
      entry: {
        pick: pick as unknown as SpecEntry["pick"],
        ownership: toSpecOwnership(ownership),
        local: r.locals[i] as unknown as SpecEntry["local"],
      },
    };
  });
}

export function cardSpecOf(r: SearchResult, model: string) {
  return r.cards.find((c) => c.model === model)?.spec ?? null;
}

/** The priced picks for "Next to a Low Key pick" (task 046). */
export function quotePicksOf(r: SearchResult): QuotePick[] {
  const out: QuotePick[] = [];
  for (const o of r.ownerships) {
    if (!o.model) continue;
    const label = [o.make, o.model].filter(Boolean).join(" ");
    const key = modelKey(o.model, o.make);
    if (out.some((p) => p.key === key)) continue;
    out.push({
      key,
      label,
      retention5y: o.dealInputs?.retention5y ?? null,
      dealInputs: o.dealInputs ?? null,
      deal: {
        model: label,
        price: o.price,
        taxAmount: o.taxAmount ?? 0,
        downPayment: o.downPayment,
        aprPercent: o.aprPercent,
        termMonths: o.termMonths,
        monthlyPayment: o.monthlyPayment,
        positiveEquityMonth: o.positiveEquityMonth ?? null,
      },
    });
  }
  return out;
}

export interface Sources {
  soldVehicles: number | null;
  providerAsOf: string | null;
  taxNotice: string | null;
  taxIncluded: boolean;
  lifespan: [string, string][];
  gas: [string, string][];
}

/** What the sources and assumptions note cites, from the same result. */
export function sourcesOf(r: SearchResult): Sources {
  const rank = r.rank as SearchResult["rank"] & { soldVehicles?: number; providerAsOf?: string };
  const lifespan = new Map<string, string>();
  for (const p of [...r.rank.picks, ...(r.rank.commodity ? [r.rank.commodity] : [])]) {
    const q = p as { lifespanSource?: string | null; lifespanAsOf?: string | null };
    if (q.lifespanSource) lifespan.set(q.lifespanSource, q.lifespanAsOf ?? "");
  }
  const gas = new Map<string, string>();
  for (const l of r.locals) if (l.fuel) gas.set(l.fuel.seriesDisplay, l.fuel.latestDate);
  const taxNotice = r.ownerships.find((o) => o.taxNotice)?.taxNotice ?? null;
  return {
    soldVehicles: rank.soldVehicles ?? null,
    providerAsOf: rank.providerAsOf ?? null,
    taxNotice,
    taxIncluded: Boolean(taxNotice?.startsWith("Includes")),
    lifespan: [...lifespan.entries()],
    gas: [...gas.entries()],
  };
}
