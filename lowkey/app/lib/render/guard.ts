import type { Spec } from "@json-render/core";

import { dealerUnitsFace, effectiveMonthlyCost } from "../costs";
import {
  interestPerMonth,
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
 * the report hand-checks one live card to within $1). Years, curve
 * points, miles and prices are copied unchanged and check exactly.
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
    } else c.fail(id, "unexpected-segment");
    j += 1;
  }
  const payTotal = ((props.pay as { usd: number }[]) ?? []).reduce((s, x) => s + x.usd, 0);
  const realTotal = ((props.real as { usd: number }[]) ?? []).reduce((s, x) => s + x.usd, 0);
  // Real total cross-check through the pre-existing effective-cost
  // helper (depreciation + interest + fuel over 60 months).
  const expectedReal = effectiveMonthlyCost({
    price: ownership.price,
    retentionAfterDiscount: entry.pick.retention5y,
    monthlyPayment: ownership.monthlyPayment,
    loanAmount: ownership.loanAmount,
    fuelPerMonth: gasRaw,
  });
  c.checked.add(`${base}.backWhenSold`);
  const back = props.backWhenSold;
  if (typeof back !== "number" || back !== payTotal - realTotal) c.fail(id, "back-identity");
  if (typeof realTotal === "number" && Math.abs(realTotal - expectedReal) > 2) {
    c.fail(id, "real-total");
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

function checkUnderwater(c: Checker, spec: Spec, id: string, entry: SpecEntry) {
  const props = propsOf(spec, id);
  const ownership = entry.ownership;
  if (!props || !ownership) {
    c.fail(id, "missing");
    return;
  }
  const base = `elements.${id}.props`;
  const even =
    ownership.evenMonth !== undefined ? ownership.evenMonth : (ownership.underwaterMonth ?? null);
  c.exact(id, `${base}.evenMonth`, props.evenMonth, even);
  const curve = (props.curve as { month: number; resale: number; balance: number }[]) ?? [];
  if (curve.length !== ownership.curve.length) c.fail(id, "curve-length");
  curve.forEach((point, idx) => {
    const src = ownership.curve[idx];
    if (!src) return;
    c.exact(id, `${base}.curve.${idx}.month`, point.month, src.month);
    c.exact(id, `${base}.curve.${idx}.resale`, point.resale, src.resale);
    c.exact(id, `${base}.curve.${idx}.balance`, point.balance, src.balance);
  });
}

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
}

/** Check one PickCard spec against the entry that produced it. */
export function checkPickCardSpec(spec: Spec, entry: SpecEntry): GuardResult {
  const c = new Checker(spec);
  const rootProps = propsOf(spec, spec.root);
  if (!rootProps || spec.elements[spec.root]?.type !== "PickCard") {
    c.fail(spec.root, "root-type");
    return c.finish();
  }
  c.exact(spec.root, `elements.${spec.root}.props.rank`, rootProps.rank, entry.pick.rank);
  for (const [id, el] of Object.entries(spec.elements)) {
    if (id === spec.root) continue;
    if (el.type === "CostBars") checkCostBars(c, spec, id, entry);
    else if (el.type === "LifespanTrack") checkLifespan(c, spec, id, entry);
    else if (el.type === "UnderwaterMini") checkUnderwater(c, spec, id, entry);
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
    total: number;
  }[]) ?? [];
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
    c.checked.add(`${base}.rows.${idx}.total`);
    if (row.total !== row.valueLost + row.interest + row.gas) c.fail(spec.root, "row-total");
    if (row.total < prev) c.fail(spec.root, "row-order");
    prev = row.total;
  });
  return c.finish();
}
