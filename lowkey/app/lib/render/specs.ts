import type { Spec } from "@json-render/core";

import {
  dealerUnitsFace,
  trimLineText,
  unitTitle,
} from "../costs";
import { bestAtLabels, type BestAt, type ChooserFacts } from "../chooser";
import { unitDeal, type DealInputs } from "../deal";
import { priceFacts, type PriceContext } from "../priceStats";
import { cardSentence } from "../summary";

/**
 * Spec builders (task 034, part 3). Pure functions that turn tool
 * outputs (rank_category, ownership_math, local_units) into
 * json-render specs. Our code builds every spec; the model never
 * writes a spec or a number on the card path.
 *
 * Documented rounding: every dollar amount in a spec is a whole
 * dollar (nearest dollar). Lifespan years, curve points, unit miles
 * and prices are copied from the tool outputs unchanged. Guarded by
 * guard.ts; the tests run the guard over fixtures for all three
 * categories.
 */

export interface SpecPick {
  rank: number | null;
  make: string;
  model: string;
  price: number;
  depPerMonth: number;
  retention5y: number;
  flag?: "badge" | "extra";
  baseTrim?: string | null;
  stepUpTrim?: string | null;
  recommendedTrim?: string | null;
  trimStepCost?: number | null;
  trimIsStepUp?: boolean;
  trimGuardHit?: boolean;
  trimRetention5y?: number | null;
  trimFeatures?: string[];
  tradeInFactor?: number;
  currentYear?: number;
  lifespanYears?: number | null;
  lifespanMiles?: number | null;
  lifespanSource?: string | null;
  lifespanAsOf?: string | null;
  retentionRetail?: number;
}

export interface SpecOwnership {
  /** Price with fees, before tax. */
  price: number;
  /** Financed sales tax in dollars (task 037); absent on old outputs. */
  taxAmount?: number;
  taxStatus?: "included" | "none" | "unknown";
  taxNotice?: string | null;
  downPayment: number;
  loanAmount: number;
  monthlyPayment: number;
  aprPercent: number;
  termMonths: number;
  positiveEquityMonth?: number | null;
  evenMonth?: number | null;
  underwaterMonth?: number | null;
  curve: { month: number; resale: number; balance: number; equity?: number }[];
  /** Assumptions for pricing another local unit (task 041). */
  dealInputs?: DealInputs;
}

export interface SpecUnit {
  dealer: string;
  distanceMiles: number;
  daysOnLot?: number | null;
  year?: number | null;
  trim?: string | null;
  price: number;
  url: string;
  vin?: string | null;
  /** Task 054: the advertised price, the unit's own MSRP, the dealer's place. */
  listedPrice?: number | null;
  msrp?: number | null;
  city?: string | null;
  state?: string | null;
}

export interface SpecLocal {
  model?: string | null;
  error?: string | null;
  fellBackToBase?: boolean;
  fuel?: { perMonth: number; mpg?: number; mpgLevel?: string } | null;
  units: SpecUnit[];
  /** Cheapest local price (task 038 price position). */
  bestPrice?: number | null;
  /** Provider total at the radius used. */
  totalFound?: number;
  /** Radius the search settled on (50, widened to 150). */
  radiusUsed?: number;
}

/**
 * Listing position for one entry (task 038, part 5.6): the cheapest
 * price, how many listings it is the lowest of, the radius, and the
 * dearest price only when every listing is already returned (so the
 * full listed range is known without an extra provider call).
 */
export interface ListingStats {
  price: number;
  total: number;
  radius: number | null;
  max: number | null;
}

export function listingStats(local: SpecLocal | undefined): ListingStats | null {
  if (!local || local.error) return null;
  const units = local.units ?? [];
  if (units.length === 0) return null;
  const prices = units.map((u) => u.price);
  const price = local.bestPrice ?? Math.min(...prices);
  const total = local.totalFound ?? units.length;
  const max = total <= units.length ? Math.max(...prices) : null;
  return { price, total, radius: local.radiusUsed ?? null, max };
}

export interface SpecEntry {
  pick: SpecPick;
  ownership?: SpecOwnership;
  local?: SpecLocal;
  /** Task 054: the market around the unit the card is priced on. */
  context?: PriceContext | null;
  /** Task 054: the unit the shopper chose, which the ownership prices. */
  chosen?: { vin: string; source: "local" | "far"; unit: SpecUnit } | null;
}

/** Whole dollars, the one documented rounding for spec amounts. */
export function usd(n: number): number {
  return Math.round(n);
}

/** Stable element-id slug for a pick ("Honda CR-V" -> "honda-cr-v"). */
export function pickSlug(pick: Pick<SpecPick, "make" | "model">): string {
  return `${pick.make} ${pick.model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Positive-equity month from any ownership shape (new field first). */
export function positiveMonthOf(ownership: SpecOwnership): number | null {
  if (ownership.positiveEquityMonth !== undefined) {
    return ownership.positiveEquityMonth;
  }
  if (ownership.evenMonth !== undefined) return ownership.evenMonth;
  return ownership.underwaterMonth ?? null;
}

/** Equity of one curve point; old outputs without equity derive it. */
export function equityOfPoint(point: {
  resale: number;
  balance: number;
  equity?: number;
}): number {
  return point.equity ?? point.resale - point.balance;
}

/** Monthly value lost (depreciation) from tool outputs, unrounded. */
export function valueLostPerMonth(pick: SpecPick, ownership: SpecOwnership): number {
  return (ownership.price * (1 - pick.retention5y)) / 60;
}

/** Monthly interest from tool outputs, unrounded. */
export function interestPerMonth(ownership: SpecOwnership): number {
  return (ownership.monthlyPayment * 60 - ownership.loanAmount) / 60;
}

function gasPerMonth(entry: SpecEntry): number | null {
  const gas = entry.local?.fuel?.perMonth;
  return gas === undefined || gas === null ? null : gas;
}

export interface CostBreakdown {
  loan: number;
  gas: number | null;
  valueLost: number;
  interest: number;
  /** Sales tax a month (financed tax / 60), whole dollars. */
  tax: number;
  /** loan + gas, whole dollars (the CostBars scale). */
  bills: number;
  /** valueLost + interest + gas + tax, whole dollars. */
  real: number;
  /** bills - real: what comes back when sold at 5 years. */
  back: number;
}

/** Whole-dollar cost split for one entry, or null with no ownership. */
export function costBreakdown(entry: SpecEntry): CostBreakdown | null {
  const ownership = entry.ownership;
  if (!ownership) return null;
  const gas = gasPerMonth(entry);
  const loan = usd(ownership.monthlyPayment);
  const gasUsd = gas === null ? null : usd(gas);
  const valueLost = usd(valueLostPerMonth(entry.pick, ownership));
  const interest = usd(interestPerMonth(ownership));
  // Totals are the rounded unrounded sums (the mockup's CR-V: real
  // $461 from 197 + 97 + 166 segments), so a total can differ from
  // its rounded segment sum by a dollar. Guarded to $1 (totals) and
  // $2 (segment-sum drift) in guard.ts.
  const gasRaw = gas ?? 0;
  const taxRaw = (ownership.taxAmount ?? 0) / 60;
  const tax = usd(taxRaw);
  const bills = usd(ownership.monthlyPayment + gasRaw);
  const real = usd(
    valueLostPerMonth(entry.pick, ownership) +
      interestPerMonth(ownership) +
      gasRaw +
      taxRaw,
  );
  return { loan, gas: gasUsd, valueLost, interest, tax, bills, real, back: bills - real };
}

function costBarsProps(entry: SpecEntry) {
  const costs = costBreakdown(entry);
  if (!costs) return null;
  type Segment = { part: "loan" | "gas" | "valueLost" | "interest" | "tax"; usd: number };
  const pay: Segment[] = [{ part: "loan", usd: costs.loan }];
  if (costs.gas !== null) pay.push({ part: "gas", usd: costs.gas });
  const real: Segment[] = [
    { part: "valueLost", usd: costs.valueLost },
    { part: "interest", usd: costs.interest },
  ];
  if (costs.gas !== null) real.push({ part: "gas", usd: costs.gas });
  if (costs.tax > 0) real.push({ part: "tax", usd: costs.tax });
  const fuel = entry.local?.fuel;
  return {
    pay,
    real,
    payTotal: costs.bills,
    realTotal: costs.real,
    backWhenSold: costs.back,
    // Task 042, part 2b: the MPG behind the gas segment, when known.
    ...(fuel && typeof fuel.mpg === "number"
      ? { gasMpg: fuel.mpg, gasMpgTypical: fuel.mpgLevel === "typical" }
      : {}),
  };
}

/** Closest local unit in miles, or null with none nearby. */
export function nearestMilesOf(local: SpecLocal | undefined): number | null {
  if (!local || local.error) return null;
  const units = local.units ?? [];
  if (units.length === 0) return null;
  return Math.min(...units.map((u) => u.distanceMiles));
}

/** Chooser facts (task 040) for every entry with an ownership result. */
export function chooserFactsOf(entries: SpecEntry[]): ChooserFacts[] {
  const facts: ChooserFacts[] = [];
  for (const entry of entries) {
    const costs = costBreakdown(entry);
    if (!costs) continue;
    facts.push({
      model: entry.pick.model,
      label: `${entry.pick.make} ${entry.pick.model}`,
      retention: entry.pick.retention5y,
      total: costs.real,
      bills: costs.bills,
      nearestMiles: nearestMilesOf(entry.local),
      lifespanYears: entry.pick.lifespanYears ?? null,
    });
  }
  return facts;
}

/** Model -> best-at labels for one turn (task 040; no rank numbers). */
export function turnLabels(entries: SpecEntry[]): Map<string, BestAt[]> {
  return bestAtLabels(chooserFactsOf(entries));
}

function modelLabel(pick: SpecPick): string {
  const trim = pick.recommendedTrim?.trim();
  const base = `${pick.make} ${pick.model}`;
  return trim ? `${base} ${trim}` : base;
}

/**
 * One PickCard spec per pick. Children follow the mockup order
 * (CostBars, LifespanTrack, EquityMini, DealerLine); a child is
 * omitted when its tool output is missing.
 */
export function buildPickCardSpec(
  entry: SpecEntry,
  peers: SpecPick[],
  category: string,
  labels: readonly string[] = [],
): Spec {
  const { pick, ownership, local } = entry;
  const slug = pickSlug(pick);
  const elements: Spec["elements"] = {};
  const children: string[] = [];

  const bars = costBarsProps(entry);
  if (bars) {
    const id = `${slug}-cost`;
    elements[id] = { type: "CostBars", props: bars, children: [] };
    children.push(id);
  }

  const lifeId = `${slug}-life`;
  const years = pick.lifespanYears ?? null;
  elements[lifeId] = {
    type: "LifespanTrack",
    props: {
      years,
      loanYears: (ownership?.termMonths ?? 60) / 12,
      miles:
        years === null
          ? null
          : (pick.lifespanMiles ?? usd(years * 12000)),
      source: pick.lifespanSource ?? null,
    },
    children: [],
  };
  children.push(lifeId);

  if (ownership && ownership.curve.length > 0) {
    const waterId = `${slug}-equity`;
    elements[waterId] = {
      type: "EquityMini",
      props: {
        positiveEquityMonth: positiveMonthOf(ownership),
        curve: ownership.curve.map((p) => ({
          month: p.month,
          resale: p.resale,
          balance: p.balance,
          equity: equityOfPoint(p),
        })),
      },
      children: [],
    };
    children.push(waterId);
  }

  const dealerId = `${slug}-dealer`;
  const units = local?.units ?? [];
  const modelForUnits = local?.model ?? pick.model;
  const facePlan = dealerUnitsFace(units, pick.currentYear);
  const stats = listingStats(local);
  const chosenVin = entry.chosen?.vin ?? null;
  const toUnit = (u: SpecUnit, note: string | null) => ({
    title: unitTitle(u.year, modelForUnits, u.trim),
    miles: u.distanceMiles,
    price: u.price,
    dealer: u.dealer,
    url: u.url,
    note,
    vin: u.vin ?? null,
    chosen: chosenVin !== null && u.vin === chosenVin,
  });
  elements[dealerId] = {
    type: "DealerLine",
    props: {
      face: facePlan.face ? toUnit(facePlan.face, facePlan.faceNote) : null,
      more: facePlan.more.map(({ unit, note }) => toUnit(unit, note)),
      error: local?.error ?? null,
      listingTotal: stats ? stats.total : null,
      listingRadius: stats ? stats.radius : null,
      listingMax: stats ? stats.max : null,
    },
    children: [],
  };
  children.push(dealerId);

  elements[slug] = {
    type: "PickCard",
    props: {
      labels: [...labels],
      modelLabel: modelLabel(pick),
      sentence: cardSentence(pick, undefined, peers.length > 0 ? peers : [pick], category),
      trimLine: trimLineText({
        baseTrim: pick.baseTrim,
        stepUpTrim: pick.stepUpTrim,
        recommendedTrim: pick.recommendedTrim,
        trimIsStepUp: pick.trimIsStepUp,
        trimGuardHit: pick.trimGuardHit,
        trimRetention5y: pick.trimRetention5y,
        modelRetentionRetail: pick.retentionRetail ?? pick.retention5y / 0.85,
        tradeInFactor: pick.tradeInFactor,
        trimStepCost: pick.trimStepCost,
        trimFeatures: pick.trimFeatures,
        aprPercent: ownership?.aprPercent,
        fellBackToBase: local?.fellBackToBase,
      }),
      inStock: units.length > 0,
      category,
      modelKey: pick.model,
      hasWalkAway: Boolean(ownership),
      // Task 054: the card says when it is priced on the shopper's own pick.
      chosenNote: entry.chosen
        ? `Priced on the car you're going for, at ${entry.chosen.unit.dealer}${entry.chosen.source === "far" ? ` in ${[entry.chosen.unit.city, entry.chosen.unit.state].filter(Boolean).join(", ")}` : ""}.`
        : null,
    },
    children,
  };
  return { root: slug, elements };
}

/**
 * One CostCompare spec per turn, the chooser (task 040): every entry
 * with an ownership result, in the default "Real cost" order (lowest
 * real cost first; the view re-sorts on the shopper's choice). Each
 * row carries the figures every sort needs and its best-at labels.
 * No rank and no highlight: every car shown is one we stand behind.
 * Null with fewer than two comparable entries.
 */
export function buildCostCompareSpec(entries: SpecEntry[], category: string): Spec | null {
  const labels = turnLabels(entries);
  const rows = entries
    .map((entry) => {
      const costs = costBreakdown(entry);
      if (!costs) return null;
      const stats = listingStats(entry.local);
      return {
        label: `${entry.pick.make} ${entry.pick.model}`,
        model: entry.pick.model,
        trim: entry.pick.recommendedTrim?.trim() || null,
        labels: [...(labels.get(entry.pick.model) ?? [])],
        valueLost: costs.valueLost,
        interest: costs.interest,
        gas: costs.gas ?? 0,
        tax: costs.tax,
        total: costs.real,
        bills: costs.bills,
        nearestMiles: nearestMilesOf(entry.local),
        lifespanYears: entry.pick.lifespanYears ?? null,
        price: stats ? stats.price : null,
        listingTotal: stats ? stats.total : null,
        // Task 054: the priced unit against the local median, and whether
        // the shopper chose that unit.
        vsLocalMedian: entry.context ? priceFacts(entry.context).vsLocalMedian : null,
        chosen: Boolean(entry.chosen),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length < 2) return null;
  rows.sort((a, b) => a.total - b.total || a.label.localeCompare(b.label));
  return {
    root: "compare",
    elements: {
      compare: {
        type: "CostCompare",
        props: { category, rows },
        children: [],
      },
    },
  };
}

/** Every spec for one turn: the comparison plus one card per entry. */
export function buildTurnSpecs(
  entries: SpecEntry[],
  category: string,
): { compare: Spec | null; cards: Map<string, Spec> } {
  const peers = entries.map((e) => e.pick);
  const labels = turnLabels(entries);
  const cards = new Map<string, Spec>();
  for (const entry of entries) {
    cards.set(
      entry.pick.model,
      buildPickCardSpec(entry, peers, category, labels.get(entry.pick.model) ?? []),
    );
  }
  return { compare: buildCostCompareSpec(entries, category), cards };
}

/**
 * The listing sheet (task 041, part 1): one local unit with its own
 * estimated out-the-door price, monthly bills and positive-equity
 * month, priced at the turn's assumptions. Null when the unit is not
 * in the entry's tool results or the ownership output predates the
 * deal inputs. Dollars are whole dollars, as everywhere in specs.
 */
export function buildListingSpec(entry: SpecEntry, url: string, extra: readonly SpecUnit[] = []): Spec | null {
  const { pick, ownership, local } = entry;
  // Task 054: far-away units (the chosen one, or a lead) price the same way.
  const unit = [...(local?.units ?? []), ...(entry.chosen ? [entry.chosen.unit] : []), ...extra].find(
    (u) => u.url === url,
  );
  const inputs = ownership?.dealInputs;
  if (!unit || !ownership || !inputs) return null;
  const gas = gasPerMonth(entry);
  const deal = unitDeal(inputs, unit.price, gas);
  const title = [unit.year ?? null, pick.make, local?.model ?? pick.model, unit.trim ?? null]
    .filter((p) => p !== null && p !== "")
    .join(" ");
  return {
    root: "listing",
    elements: {
      listing: {
        type: "ListingDetail",
        props: {
          modelKey: pick.model,
          title,
          vin: unit.vin ?? null,
          dealer: unit.dealer,
          miles: unit.distanceMiles,
          daysOnLot: unit.daysOnLot ?? null,
          price: unit.price,
          tax: deal.tax === null ? null : usd(deal.tax),
          outTheDoor: deal.outTheDoor === null ? null : usd(deal.outTheDoor),
          taxNotice: ownership.taxNotice ?? null,
          down: usd(deal.down),
          downShare: inputs.downRule.kind === "share" ? inputs.downRule.share : null,
          aprPercent: inputs.aprPercent,
          termMonths: inputs.termMonths,
          loan: usd(deal.loan),
          gas: gas === null ? null : usd(gas),
          bills: usd(deal.bills),
          positiveEquityMonth: deal.positiveEquityMonth,
          url: unit.url,
        },
        children: [],
      },
    },
  };
}

/** The unit a price strip marks: the card's priced unit, or a listing's. */
export interface StripUnit {
  vin: string | null;
  year: number | null;
  listedPrice: number | null;
  msrp: number | null;
}

/** The unit the card is priced on: the chosen one, else the cheapest local one. */
export function pricedUnitOf(entry: SpecEntry): SpecUnit | null {
  return entry.chosen?.unit ?? entry.local?.units?.[0] ?? null;
}

export function stripUnitOf(u: SpecUnit): StripUnit {
  return { vin: u.vin ?? null, year: u.year ?? null, listedPrice: u.listedPrice ?? null, msrp: u.msrp ?? null };
}

/**
 * The price strip (task 054, part 2): the local range (p5 to p95 with
 * the p25–p75 band), the local and national medians, the MSRP and the
 * marked unit. Figures copy the provider stats and the listing exactly;
 * the differences are computed by priceFacts. A unit of another model
 * year than the stats gets no comparison (the strip says why). Null
 * without a context.
 */
export function buildPriceStripSpec(entry: SpecEntry, unit: StripUnit): Spec | null {
  const ctx = entry.context;
  if (!ctx) return null;
  const sameYear = unit.year !== null && unit.year === ctx.year;
  const facts = priceFacts({ ...ctx, unit: { vin: unit.vin, listedPrice: sameYear ? unit.listedPrice : null, msrp: unit.msrp } });
  const title = [ctx.year, ctx.model, ctx.trim].filter((p) => p !== null && p !== "").join(" ");
  const local = ctx.local;
  return {
    root: "strip",
    elements: {
      strip: {
        type: "PriceStrip",
        props: {
          modelKey: entry.pick.model,
          title,
          year: ctx.year,
          unitYear: unit.year,
          sameYear,
          radius: ctx.radius,
          localLoaded: local !== null,
          nationalLoaded: ctx.national !== null,
          localCount: local ? local.count : null,
          low: local ? local.p5 : null,
          p25: local ? local.p25 : null,
          localMedian: local ? local.median : null,
          p75: local ? local.p75 : null,
          high: local ? local.p95 : null,
          nationalMedian: ctx.national ? ctx.national.median : null,
          nationalCount: ctx.national ? ctx.national.count : null,
          msrp: facts.msrp,
          msrpOwn: facts.msrpOwn,
          listed: facts.listed,
          vsLocalMedian: facts.vsLocalMedian,
          vsNationalMedian: facts.vsNationalMedian,
          vsMsrp: facts.vsMsrp,
          positionSide: facts.position ? facts.position.side : null,
          positionShare: facts.position ? facts.position.share : null,
        },
        children: [],
      },
    },
  };
}
