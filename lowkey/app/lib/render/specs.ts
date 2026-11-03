import type { Spec } from "@json-render/core";

import {
  dealerUnitsFace,
  trimLineText,
  unitTitle,
} from "../costs";
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
  price: number;
  downPayment: number;
  loanAmount: number;
  monthlyPayment: number;
  aprPercent: number;
  termMonths: number;
  evenMonth?: number | null;
  underwaterMonth?: number | null;
  curve: { month: number; resale: number; balance: number }[];
}

export interface SpecUnit {
  dealer: string;
  distanceMiles: number;
  daysOnLot?: number | null;
  year?: number | null;
  trim?: string | null;
  price: number;
  url: string;
}

export interface SpecLocal {
  model?: string | null;
  error?: string | null;
  fellBackToBase?: boolean;
  fuel?: { perMonth: number } | null;
  units: SpecUnit[];
}

export interface SpecEntry {
  pick: SpecPick;
  ownership?: SpecOwnership;
  local?: SpecLocal;
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
  /** loan + gas, whole dollars (the CostBars scale). */
  bills: number;
  /** valueLost + interest + gas, whole dollars. */
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
  const bills = loan + (gasUsd ?? 0);
  const real = valueLost + interest + (gasUsd ?? 0);
  return { loan, gas: gasUsd, valueLost, interest, bills, real, back: bills - real };
}

function costBarsProps(entry: SpecEntry) {
  const costs = costBreakdown(entry);
  if (!costs) return null;
  type Segment = { part: "loan" | "gas" | "valueLost" | "interest"; usd: number };
  const pay: Segment[] = [{ part: "loan", usd: costs.loan }];
  if (costs.gas !== null) pay.push({ part: "gas", usd: costs.gas });
  const real: Segment[] = [
    { part: "valueLost", usd: costs.valueLost },
    { part: "interest", usd: costs.interest },
  ];
  if (costs.gas !== null) real.push({ part: "gas", usd: costs.gas });
  return { pay, real, backWhenSold: costs.back };
}

function badgeLabel(pick: SpecPick): string {
  if (pick.flag === "badge") return "Cheapest to own";
  if (pick.flag === "extra") return "Extra pick · cheapest to own";
  return pick.rank ? `Pick #${pick.rank}` : "Pick";
}

function modelLabel(pick: SpecPick): string {
  const trim = pick.recommendedTrim?.trim();
  const base = `${pick.make} ${pick.model}`;
  return trim ? `${base} ${trim}` : base;
}

/**
 * One PickCard spec per pick. Children follow the mockup order
 * (CostBars, LifespanTrack, UnderwaterMini, DealerLine); a child is
 * omitted when its tool output is missing.
 */
export function buildPickCardSpec(
  entry: SpecEntry,
  peers: SpecPick[],
  category: string,
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
    const waterId = `${slug}-water`;
    elements[waterId] = {
      type: "UnderwaterMini",
      props: {
        evenMonth:
          ownership.evenMonth !== undefined
            ? ownership.evenMonth
            : (ownership.underwaterMonth ?? null),
        curve: ownership.curve.map((p) => ({
          month: p.month,
          resale: p.resale,
          balance: p.balance,
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
  const toUnit = (u: SpecUnit, note: string | null) => ({
    title: unitTitle(u.year, modelForUnits, u.trim),
    miles: u.distanceMiles,
    price: u.price,
    dealer: u.dealer,
    url: u.url,
    note,
  });
  elements[dealerId] = {
    type: "DealerLine",
    props: {
      face: facePlan.face ? toUnit(facePlan.face, facePlan.faceNote) : null,
      more: facePlan.more.map(({ unit, note }) => toUnit(unit, note)),
      error: local?.error ?? null,
    },
    children: [],
  };
  children.push(dealerId);

  elements[slug] = {
    type: "PickCard",
    props: {
      rank: pick.rank,
      badgeLabel: badgeLabel(pick),
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
      lifespanSource: pick.lifespanSource ?? null,
      lifespanAsOf: pick.lifespanAsOf ?? null,
    },
    children,
  };
  return { root: slug, elements };
}

/**
 * One CostCompare spec per turn: every entry with an ownership
 * result, ordered cheapest to own (lowest real cost) first. The
 * highlighted row is the first ranked pick's (the card the mockup
 * shows), falling back to the first entry. Null with fewer than two
 * comparable entries.
 */
export function buildCostCompareSpec(entries: SpecEntry[], category: string): Spec | null {
  const rows = entries
    .map((entry) => {
      const costs = costBreakdown(entry);
      if (!costs) return null;
      return {
        label: `${entry.pick.make} ${entry.pick.model}`,
        model: entry.pick.model,
        rank: entry.pick.rank,
        valueLost: costs.valueLost,
        interest: costs.interest,
        gas: costs.gas ?? 0,
        total: costs.real,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length < 2) return null;
  const shown = entries.find((e) => e.pick.rank === 1) ?? entries[0];
  const shownModel = shown?.pick.model;
  rows.sort((a, b) => a.total - b.total);
  return {
    root: "compare",
    elements: {
      compare: {
        type: "CostCompare",
        props: {
          category,
          rows: rows.map((r) => ({
            label: r.label,
            valueLost: r.valueLost,
            interest: r.interest,
            gas: r.gas,
            total: r.total,
            highlighted: r.model === shownModel,
          })),
        },
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
  const cards = new Map<string, Spec>();
  for (const entry of entries) {
    cards.set(entry.pick.model, buildPickCardSpec(entry, peers, category));
  }
  return { compare: buildCostCompareSpec(entries, category), cards };
}
