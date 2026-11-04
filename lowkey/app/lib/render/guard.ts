import type { Spec } from "@json-render/core";

import { dealerUnitsFace, effectiveMonthlyCost } from "../costs";
import { unitDeal } from "../deal";
import { farMargin, positionOf } from "../priceStats";
import {
  interestPerMonth,
  listingStats,
  nearestMilesOf,
  type SpecUnit,
  type StripUnit,
  turnLabels,
  valueLostPerMonth,
  type SpecEntry,
} from "./specs";

/**
 * Number guard (task 034, part 5). Walks a spec and checks every
 * number in it against the tool outputs that produced it.
 *
 * Documented rounding: dollar amounts in specs are whole dollars, so
 * a spec dollar checks within $1 of the unrounded tool figure it was
 * rounded from. Totals that are sums of spec segments check exactly
 * (they are sums of the same rounded segments). The "back to you"
 * figure checks two ways: exactly as bills - real inside the spec,
 * and within $3 of (resale at month 60 - down payment) / 60 from the
 * ownership curve (accumulated rounding of five rounded quantities;
 * the report hand-checks one live card to within $1). The sales-tax
 * segment (task 037) checks against financed tax / 60 the same way,
 * and the real-cost total cross-checks through effectiveMonthlyCost
 * with the tax included, so the back-to-you identity still holds.
 * Years, curve points, miles and prices are copied unchanged and
 * check exactly.
 *
 * Failures carry only an element id and a check name, never a value,
 * so a runtime failure can be logged without data.
 */

export interface GuardFailure {
  element: string;
  check: string;
}

export interface GuardResult {
  ok: boolean;
  failures: GuardFailure[];
}

const DOLLAR_TOLERANCE = 1;
const BACK_TOLERANCE = 3;

type Props = Record<string, unknown>;

function propsOf(spec: Spec, id: string): Props | null {
  const el = spec.elements[id];
  if (!el) return null;
  return (el.props ?? {}) as Props;
}

function numbersIn(value: unknown, path: string, out: Map<string, number>): void {
  if (typeof value === "number") {
    out.set(path, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => numbersIn(v, `${path}.${i}`, out));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      numbersIn(v, `${path}.${k}`, out);
    }
  }
}

/** Every numeric leaf of a spec, by dotted path. */
export function collectSpecNumbers(spec: Spec): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, el] of Object.entries(spec.elements)) {
    numbersIn(el.props, `elements.${id}.props`, out);
  }
  return out;
}

class Checker {
  failures: GuardFailure[] = [];
  checked = new Set<string>();

  constructor(private spec: Spec) {}

  fail(element: string, check: string) {
    this.failures.push({ element, check });
  }

  /** Exact check (copied numbers: years, curve, miles, prices, rank). */
  exact(element: string, path: string, actual: unknown, expected: number | null) {
    this.checked.add(path);
    if (expected === null) {
      if (actual !== null && actual !== undefined) this.fail(element, "expected-null");
      return;
    }
    if (typeof actual !== "number" || actual !== expected) {
      this.fail(element, "exact");
    }
  }

  /** Whole-dollar check against an unrounded tool figure. */
  dollar(element: string, path: string, actual: unknown, expectedRaw: number) {
    this.checked.add(path);
    if (typeof actual !== "number" || Math.abs(actual - expectedRaw) > DOLLAR_TOLERANCE) {
      this.fail(element, "dollar-rounding");
    }
  }

  finish(): GuardResult {
    const all = collectSpecNumbers(this.spec);
    for (const path of all.keys()) {
      if (!this.checked.has(path)) {
        const element = path.split(".")[1] ?? "spec";
        this.fail(element, "unchecked-number");
      }
    }
    return { ok: this.failures.length === 0, failures: this.failures };
  }
}

function segmentUsd(props: Props, bar: "pay" | "real", part: string): number | undefined {
  const arr = props[bar];
  if (!Array.isArray(arr)) return undefined;
  const seg = arr.find(
    (s): s is { part: string; usd: number } =>
      typeof s === "object" && s !== null && (s as { part?: unknown }).part === part,
  );
  return seg?.usd;
}

function checkCostBars(c: Checker, spec: Spec, id: string, entry: SpecEntry) {
  const props = propsOf(spec, id);
  const ownership = entry.ownership;
  if (!props || !ownership) {
    c.fail(id, "missing");
    return;
  }
  const gasRaw = entry.local?.fuel?.perMonth ?? null;
  const base = `elements.${id}.props`;
  let i = 0;
  for (const seg of (props.pay as { part: string }[]) ?? []) {
    const path = `${base}.pay.${i}.usd`;
    if (seg.part === "loan") c.dollar(id, path, segmentUsd(props, "pay", "loan"), ownership.monthlyPayment);
    else if (seg.part === "gas") {
      if (gasRaw === null) c.fail(id, "unexpected-gas");
      else c.dollar(id, path, segmentUsd(props, "pay", "gas"), gasRaw);
    } else c.fail(id, "unexpected-segment");
    i += 1;
  }
  if (gasRaw !== null && segmentUsd(props, "pay", "gas") === undefined) c.fail(id, "missing-gas");
  // Task 042: the MPG note copies the fuel estimate's MPG exactly.
  if (props.gasMpg !== undefined) {
    c.exact(id, `${base}.gasMpg`, props.gasMpg, entry.local?.fuel?.mpg ?? null);
  }
  const taxRaw = (ownership.taxAmount ?? 0) / 60;
  let j = 0;
  for (const seg of (props.real as { part: string }[]) ?? []) {
    const path = `${base}.real.${j}.usd`;
    if (seg.part === "valueLost") {
      c.dollar(id, path, segmentUsd(props, "real", "valueLost"), valueLostPerMonth(entry.pick, ownership));
    } else if (seg.part === "interest") {
      c.dollar(id, path, segmentUsd(props, "real", "interest"), interestPerMonth(ownership));
    } else if (seg.part === "gas") {
      if (gasRaw === null) c.fail(id, "unexpected-gas");
      else c.dollar(id, path, segmentUsd(props, "real", "gas"), gasRaw);
    } else if (seg.part === "tax") {
      c.dollar(id, path, segmentUsd(props, "real", "tax"), taxRaw);
    } else c.fail(id, "unexpected-segment");
    j += 1;
  }
  if (Math.round(taxRaw) > 0 && segmentUsd(props, "real", "tax") === undefined) {
    c.fail(id, "missing-tax");
  }
  // Totals are rounded unrounded sums (mockup rounding), checked
  // to $1 against the raw tool figures; the pre-existing
  // effective-cost helper cross-checks the real total.
  const payTotal = props.payTotal;
  const realTotal = props.realTotal;
  c.dollar(id, `${base}.payTotal`, payTotal, ownership.monthlyPayment + (gasRaw ?? 0));
  const expectedReal = effectiveMonthlyCost({
    price: ownership.price,
    retentionAfterDiscount: entry.pick.retention5y,
    monthlyPayment: ownership.monthlyPayment,
    loanAmount: ownership.loanAmount,
    fuelPerMonth: gasRaw,
    taxAmount: ownership.taxAmount ?? 0,
  });
  c.dollar(id, `${base}.realTotal`, realTotal, expectedReal);
  c.checked.add(`${base}.backWhenSold`);
  const back = props.backWhenSold;
  if (
    typeof back !== "number" ||
    typeof payTotal !== "number" ||
    typeof realTotal !== "number" ||
    back !== payTotal - realTotal
  ) {
    c.fail(id, "back-identity");
  }
  const at60 = ownership.curve.find((p) => p.month === 60);
  if (typeof back === "number" && at60) {
    const viaResale = (at60.resale - ownership.downPayment) / 60;
    if (Math.abs(back - viaResale) > BACK_TOLERANCE) c.fail(id, "back-vs-resale");
  }
}

function checkLifespan(c: Checker, spec: Spec, id: string, entry: SpecEntry) {
  const props = propsOf(spec, id);
  if (!props) {
    c.fail(id, "missing");
    return;
  }
  const base = `elements.${id}.props`;
  const years = entry.pick.lifespanYears ?? null;
  c.exact(id, `${base}.years`, props.years, years);
  const expectedMiles =
    years === null
      ? null
      : (entry.pick.lifespanMiles ?? Math.round(years * 12000));
  c.exact(id, `${base}.miles`, props.miles, expectedMiles);
  c.exact(id, `${base}.loanYears`, props.loanYears, (entry.ownership?.termMonths ?? 60) / 12);
}

function checkEquity(c: Checker, spec: Spec, id: string, entry: SpecEntry) {
  const props = propsOf(spec, id);
  const ownership = entry.ownership;
  if (!props || !ownership) {
    c.fail(id, "missing");
    return;
  }
  const base = `elements.${id}.props`;
  const expectedMonth =
    ownership.positiveEquityMonth !== undefined
      ? ownership.positiveEquityMonth
      : ownership.evenMonth !== undefined
        ? ownership.evenMonth
        : (ownership.underwaterMonth ?? null);
  // New specs carry positiveEquityMonth; legacy specs carry evenMonth.
  if (props.positiveEquityMonth !== undefined) {
    c.exact(id, `${base}.positiveEquityMonth`, props.positiveEquityMonth, expectedMonth);
  } else {
    c.exact(id, `${base}.evenMonth`, props.evenMonth, expectedMonth);
  }
  const curve = (props.curve as {
    month: number;
    resale: number;
    balance: number;
    equity?: number;
  }[]) ?? [];
  if (curve.length !== ownership.curve.length) c.fail(id, "curve-length");
  curve.forEach((point, idx) => {
    const src = ownership.curve[idx];
    if (!src) return;
    c.exact(id, `${base}.curve.${idx}.month`, point.month, src.month);
    c.exact(id, `${base}.curve.${idx}.resale`, point.resale, src.resale);
    c.exact(id, `${base}.curve.${idx}.balance`, point.balance, src.balance);
    const srcEquity = src.equity ?? src.resale - src.balance;
    c.exact(id, `${base}.curve.${idx}.equity`, point.equity, srcEquity);
    // Equity must also tie to its own resale and balance in the spec.
    if (
      typeof point.equity === "number" &&
      typeof point.resale === "number" &&
      typeof point.balance === "number" &&
      Math.abs(point.equity - (point.resale - point.balance)) > 0.02
    ) {
      c.fail(id, "equity-identity");
    }
  });
}

/** Legacy name kept for any external caller. */
const checkUnderwater = checkEquity;

function checkDealer(c: Checker, spec: Spec, id: string, entry: SpecEntry) {
  const props = propsOf(spec, id);
  if (!props) {
    c.fail(id, "missing");
    return;
  }
  const base = `elements.${id}.props`;
  const plan = dealerUnitsFace(entry.local?.units ?? [], entry.pick.currentYear);
  const checkUnit = (
    actual: { miles?: unknown; price?: unknown } | null,
    expected: { distanceMiles: number; price: number } | null,
    path: string,
  ) => {
    if (expected === null) {
      if (actual !== null && actual !== undefined) c.fail(id, "unexpected-unit");
      return;
    }
    if (!actual) {
      c.fail(id, "missing-unit");
      return;
    }
    c.exact(id, `${path}.miles`, actual.miles, expected.distanceMiles);
    c.exact(id, `${path}.price`, actual.price, expected.price);
  };
  // Task 054: a unit is marked chosen only when its VIN is the choice.
  const chosenVin = entry.chosen?.vin ?? null;
  const checkChosen = (actual: { chosen?: unknown; vin?: unknown } | null | undefined, expected: { vin?: string | null } | null) => {
    if (!actual || !expected) return;
    if (actual.vin !== undefined && (actual.vin ?? null) !== (expected.vin ?? null)) c.fail(id, "unit-vin");
    const want = chosenVin !== null && expected.vin === chosenVin;
    if (Boolean(actual.chosen) !== want) c.fail(id, "chosen-unit");
  };
  checkChosen(props.face as { chosen?: unknown } | null, plan.face);
  ((props.more as { chosen?: unknown }[]) ?? []).forEach((u, idx) => checkChosen(u, plan.more[idx]?.unit ?? null));
  checkUnit(
    (props.face as { miles?: unknown; price?: unknown } | null) ?? null,
    plan.face ? { distanceMiles: plan.face.distanceMiles, price: plan.face.price } : null,
    `${base}.face`,
  );
  const more = (props.more as { miles?: unknown; price?: unknown }[]) ?? [];
  if (more.length !== plan.more.length) c.fail(id, "more-count");
  more.forEach((unit, idx) => {
    const src = plan.more[idx]?.unit;
    if (!src) return;
    c.exact(id, `${base}.more.${idx}.miles`, unit.miles, src.distanceMiles);
    c.exact(id, `${base}.more.${idx}.price`, unit.price, src.price);
  });
  // Task 038: price-position figures copy the listing totals exactly.
  const stats = listingStats(entry.local);
  c.exact(id, `${base}.listingTotal`, props.listingTotal, stats ? stats.total : null);
  c.exact(id, `${base}.listingRadius`, props.listingRadius, stats ? stats.radius : null);
  c.exact(id, `${base}.listingMax`, props.listingMax, stats ? stats.max : null);
}

/** Check one PickCard spec against the entry that produced it. */
export function checkPickCardSpec(spec: Spec, entry: SpecEntry): GuardResult {
  const c = new Checker(spec);
  const rootProps = propsOf(spec, spec.root);
  if (!rootProps || spec.elements[spec.root]?.type !== "PickCard") {
    c.fail(spec.root, "root-type");
    return c.finish();
  }
  // Task 040: no rank on the card; best-at labels are strings.
  if ("rank" in rootProps) c.fail(spec.root, "rank-present");
  for (const [id, el] of Object.entries(spec.elements)) {
    if (id === spec.root) continue;
    if (el.type === "CostBars") checkCostBars(c, spec, id, entry);
    else if (el.type === "LifespanTrack") checkLifespan(c, spec, id, entry);
    else if (el.type === "EquityMini" || el.type === "UnderwaterMini") checkUnderwater(c, spec, id, entry);
    else if (el.type === "DealerLine") checkDealer(c, spec, id, entry);
    else c.fail(id, "unknown-type");
  }
  return c.finish();
}

/** Check one CostCompare spec against the entries that produced it. */
export function checkCostCompareSpec(spec: Spec, entries: SpecEntry[]): GuardResult {
  const c = new Checker(spec);
  const props = propsOf(spec, spec.root);
  if (!props || spec.elements[spec.root]?.type !== "CostCompare") {
    c.fail(spec.root, "root-type");
    return c.finish();
  }
  const base = `elements.${spec.root}.props`;
  const rows = (props.rows as {
    label: string;
    valueLost: number;
    interest: number;
    gas: number;
    tax: number;
    total: number;
    bills: number;
    nearestMiles: number | null;
    lifespanYears: number | null;
    labels: string[];
    price: number | null;
    listingTotal: number | null;
    vsLocalMedian?: number | null;
    chosen?: boolean;
  }[]) ?? [];
  const labels = turnLabels(entries);
  const byLabel = new Map(entries.map((e) => [`${e.pick.make} ${e.pick.model}`, e]));
  if (rows.length !== entries.filter((e) => e.ownership).length) c.fail(spec.root, "row-count");
  let prev = -Infinity;
  rows.forEach((row, idx) => {
    const entry = byLabel.get(row.label);
    if (!entry?.ownership) {
      c.fail(spec.root, "unknown-row");
      return;
    }
    c.dollar(spec.root, `${base}.rows.${idx}.valueLost`, row.valueLost, valueLostPerMonth(entry.pick, entry.ownership));
    c.dollar(spec.root, `${base}.rows.${idx}.interest`, row.interest, interestPerMonth(entry.ownership));
    const gasRaw = entry.local?.fuel?.perMonth ?? 0;
    c.dollar(spec.root, `${base}.rows.${idx}.gas`, row.gas, gasRaw);
    c.dollar(spec.root, `${base}.rows.${idx}.tax`, row.tax, (entry.ownership.taxAmount ?? 0) / 60);
    const expectedReal = effectiveMonthlyCost({
      price: entry.ownership.price,
      retentionAfterDiscount: entry.pick.retention5y,
      monthlyPayment: entry.ownership.monthlyPayment,
      loanAmount: entry.ownership.loanAmount,
      fuelPerMonth: entry.local?.fuel?.perMonth,
      taxAmount: entry.ownership.taxAmount ?? 0,
    });
    c.dollar(spec.root, `${base}.rows.${idx}.total`, row.total, expectedReal);
    // Task 038: the row's listed-price position copies the totals.
    const stats = listingStats(entry.local);
    c.exact(spec.root, `${base}.rows.${idx}.price`, row.price, stats ? stats.price : null);
    c.exact(spec.root, `${base}.rows.${idx}.listingTotal`, row.listingTotal, stats ? stats.total : null);
    // Task 054: the priced unit's listed price less the local median,
    // recomputed from the raw context; and the chosen flag.
    const ctx = entry.context ?? null;
    const listedRaw = ctx?.unit.listedPrice ?? null;
    const medianRaw = ctx?.local?.median ?? null;
    c.exact(
      spec.root,
      `${base}.rows.${idx}.vsLocalMedian`,
      row.vsLocalMedian,
      listedRaw !== null && medianRaw !== null ? listedRaw - medianRaw : null,
    );
    if (Boolean(row.chosen) !== Boolean(entry.chosen)) c.fail(spec.root, "chosen-row");
    // Task 040: the sort figures copy or round the tool figures, and
    // the best-at labels are recomputed from them.
    c.dollar(spec.root, `${base}.rows.${idx}.bills`, row.bills, entry.ownership.monthlyPayment + gasRaw);
    // Task 055: the chosen unit's distance when one is chosen, else the nearest local unit's.
    c.exact(
      spec.root,
      `${base}.rows.${idx}.nearestMiles`,
      row.nearestMiles,
      entry.chosen ? entry.chosen.unit.distanceMiles : nearestMilesOf(entry.local),
    );
    c.exact(spec.root, `${base}.rows.${idx}.lifespanYears`, row.lifespanYears, entry.pick.lifespanYears ?? null);
    const expectedLabels = labels.get(entry.pick.model) ?? [];
    if (JSON.stringify(row.labels ?? []) !== JSON.stringify(expectedLabels)) {
      c.fail(spec.root, "labels");
    }
    if (Math.abs(row.total - (row.valueLost + row.interest + row.gas + row.tax)) > 2) {
      c.fail(spec.root, "row-total");
    }
    if (row.total < prev) c.fail(spec.root, "row-order");
    prev = row.total;
  });
  return c.finish();
}

/**
 * Check one listing-sheet spec (task 041) against its entry: the
 * unit is found by its URL in the tool results, its figures copy the
 * listing exactly, and the deal figures recompute from the ownership
 * output's assumptions (whole dollars, within $1).
 */
export function checkListingSpec(spec: Spec, entry: SpecEntry, extra: readonly SpecUnit[] = []): GuardResult {
  const c = new Checker(spec);
  const props = propsOf(spec, spec.root);
  const id = spec.root;
  if (!props || spec.elements[id]?.type !== "ListingDetail") {
    c.fail(id, "root-type");
    return c.finish();
  }
  // Task 054: a far-away unit (the chosen one, or a lead) is found the same way.
  const unit = [...(entry.local?.units ?? []), ...(entry.chosen ? [entry.chosen.unit] : []), ...extra].find(
    (u) => u.url === props.url,
  );
  const inputs = entry.ownership?.dealInputs;
  if (!unit || !inputs || props.modelKey !== entry.pick.model) {
    c.fail(id, "unknown-unit");
    return c.finish();
  }
  const base = `elements.${id}.props`;
  if ((props.vin ?? null) !== (unit.vin ?? null)) c.fail(id, "vin");
  if (props.dealer !== unit.dealer) c.fail(id, "dealer");
  c.exact(id, `${base}.miles`, props.miles, unit.distanceMiles);
  c.exact(id, `${base}.daysOnLot`, props.daysOnLot, unit.daysOnLot ?? null);
  c.exact(id, `${base}.price`, props.price, unit.price);
  const gas = entry.local?.fuel?.perMonth ?? null;
  const deal = unitDeal(inputs, unit.price, gas);
  const maybeDollar = (key: string, raw: number | null) => {
    if (raw === null) c.exact(id, `${base}.${key}`, props[key], null);
    else c.dollar(id, `${base}.${key}`, props[key], raw);
  };
  maybeDollar("tax", deal.tax);
  maybeDollar("outTheDoor", deal.outTheDoor);
  maybeDollar("gas", gas);
  c.dollar(id, `${base}.down`, props.down, deal.down);
  c.dollar(id, `${base}.loan`, props.loan, deal.loan);
  c.dollar(id, `${base}.bills`, props.bills, deal.bills);
  c.exact(
    id,
    `${base}.downShare`,
    props.downShare,
    inputs.downRule.kind === "share" ? inputs.downRule.share : null,
  );
  c.exact(id, `${base}.aprPercent`, props.aprPercent, inputs.aprPercent);
  c.exact(id, `${base}.termMonths`, props.termMonths, inputs.termMonths);
  c.exact(id, `${base}.positiveEquityMonth`, props.positiveEquityMonth, deal.positiveEquityMonth);
  return c.finish();
}

/**
 * Check one price-strip spec (task 054) against its entry's context and
 * the unit it marks: every stat copies the provider figure exactly, the
 * differences are recomputed here from the raw figures, and a unit of
 * another model year gets no comparison.
 */
export function checkPriceStripSpec(spec: Spec, entry: SpecEntry, unit: StripUnit): GuardResult {
  const c = new Checker(spec);
  const props = propsOf(spec, spec.root);
  const id = spec.root;
  const ctx = entry.context;
  if (!props || spec.elements[id]?.type !== "PriceStrip" || !ctx || props.modelKey !== entry.pick.model) {
    c.fail(id, "root-type");
    return c.finish();
  }
  const base = `elements.${id}.props`;
  const local = ctx.local;
  const national = ctx.national;
  const sameYear = unit.year !== null && unit.year === ctx.year;
  if (props.sameYear !== sameYear) c.fail(id, "same-year");
  if (props.localLoaded !== (local !== null)) c.fail(id, "local-loaded");
  if (props.nationalLoaded !== (national !== null)) c.fail(id, "national-loaded");
  c.exact(id, `${base}.year`, props.year, ctx.year);
  c.exact(id, `${base}.unitYear`, props.unitYear, unit.year);
  c.exact(id, `${base}.radius`, props.radius, ctx.radius);
  c.exact(id, `${base}.localCount`, props.localCount, local ? local.count : null);
  c.exact(id, `${base}.low`, props.low, local ? local.p5 : null);
  c.exact(id, `${base}.p25`, props.p25, local ? local.p25 : null);
  c.exact(id, `${base}.localMedian`, props.localMedian, local ? local.median : null);
  c.exact(id, `${base}.p75`, props.p75, local ? local.p75 : null);
  c.exact(id, `${base}.high`, props.high, local ? local.p95 : null);
  c.exact(id, `${base}.nationalMedian`, props.nationalMedian, national ? national.median : null);
  c.exact(id, `${base}.nationalCount`, props.nationalCount, national ? national.count : null);
  const msrp = unit.msrp ?? national?.msrpMedian ?? local?.msrpMedian ?? null;
  c.exact(id, `${base}.msrp`, props.msrp, msrp);
  if (props.msrpOwn !== (unit.msrp !== null)) c.fail(id, "msrp-own");
  const listed = sameYear ? unit.listedPrice : null;
  c.exact(id, `${base}.listed`, props.listed, listed);
  const diff = (a: number | null, b: number | null | undefined) => (a !== null && b !== null && b !== undefined ? a - b : null);
  c.exact(id, `${base}.vsLocalMedian`, props.vsLocalMedian, diff(listed, local?.median));
  c.exact(id, `${base}.vsNationalMedian`, props.vsNationalMedian, diff(listed, national?.median));
  c.exact(id, `${base}.vsMsrp`, props.vsMsrp, diff(listed, msrp));
  const pos = listed !== null && local ? positionOf(listed, local) : null;
  if ((props.positionSide ?? null) !== (pos ? pos.side : null)) c.fail(id, "position-side");
  c.exact(id, `${base}.positionShare`, props.positionShare, pos ? pos.share : null);
  return c.finish();
}

/**
 * Far-away leads (task 054) as the page receives them: each lead is
 * checked against the margin rule and its "less than nearby" figure is
 * recomputed from the two prices. A lead that fails is dropped.
 */
export function checkFarLeads<T extends { price: number; distanceMiles: number; saves: number }>(
  leads: readonly T[],
  bestLocal: number | null,
  radius: number,
  margin: number | null,
): T[] {
  if (bestLocal === null || margin === null || margin !== farMargin(bestLocal)) return [];
  return leads.filter(
    (l) => l.saves === bestLocal - l.price && l.saves >= margin && l.distanceMiles > radius,
  );
}
