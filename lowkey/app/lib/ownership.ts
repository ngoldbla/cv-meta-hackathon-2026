/**
 * Deterministic loan and walk-away maths (PRD "The two numbers
 * that matter", preflight "The ownership math"). No network, no
 * model arithmetic: every number the UI shows comes from here.
 *
 * Payment:  P = L * r / (1 - (1 + r)^-n),  L = price + tax - down,
 *           r = APR / 12, n = term in months (P = L / n if r = 0).
 *           The sales tax is financed with the car (task 037): the
 *           down payment stays 10% of the price with fees, and the
 *           resale value is unchanged, so the tax never comes back
 *           and walk-away(60) = depreciation + interest + tax.
 * Balance:  B(t) = L*(1+r)^t - P*((1+r)^t - 1)/r.
 * Resale:   R(t) = price * 0.85 * Rr^(t/60), where Rr is the
 *           fitted retail 5-year retention and 0.85 is the P13
 *           trade-in discount. Callers pass the adjusted (after
 *           discount) 5-year retention Ra = 0.85 * Rr, so
 *           R(t) = price * 0.85 * (Ra / 0.85)^(t/60).
 *           R(0) = 0.85 * price (the car leaves the lot) and
 *           R(60) = price * Ra.
 * Walk-away(t) = down + P*t - (R(t) - B(t))
 *              = depreciation(t) + interest paid by t.
 * Equity(t) = R(t) - B(t) (negative while the owner owes more
 * than the car would sell for).
 * Positive-equity month = first t with R(t) >= B(t).
 */

export const TRADE_IN_FACTOR = 0.85;
export const DEFAULT_APR_PERCENT = 8;
export const DEFAULT_TERM_MONTHS = 60;
export const DEFAULT_RETENTION_5Y = 0.6;
export const WALK_AWAY_MONTHS = [6, 12, 24, 36, 60] as const;

export interface OwnershipInput {
  /** Price with fees, before tax (the resale basis; tax excluded). */
  price: number;
  /** Sales tax in dollars, financed into the loan (task 037). */
  tax?: number;
  down?: number;
  /** Annual percentage rate, e.g. 8 means 8% per year. */
  apr?: number;
  /** Term in months. */
  term?: number;
  model?: string;
  /** Fitted 5-year retention after the 15% discount (0..1). */
  retention5y?: number;
}

export interface CurvePoint {
  month: number;
  resale: number;
  balance: number;
  /** resale − balance; negative while the owner owes more than the car would sell for. */
  equity: number;
}

export interface WalkAwayPoint {
  month: number;
  /** resale − balance; negative means the owner would still owe. */
  getBack: number;
  /** walk-away cost ÷ month. */
  costPerMonth: number;
  walkAwayCost: number;
  perMonth: number;
  balance: number;
  resale: number;
  equity: number;
}

export interface OwnershipResult {
  model: string | null;
  /** Price with fees, before tax. */
  price: number;
  /** Financed sales tax in dollars (0 when none or unknown). */
  taxAmount: number;
  downPayment: number;
  loanAmount: number;
  aprPercent: number;
  termMonths: number;
  retention5y: number;
  monthlyPayment: number;
  /** 61 points, months 0–60. */
  curve: CurvePoint[];
  /** Per-month walk-away detail for months 0–60 (slider lookup). */
  monthly: WalkAwayPoint[];
  walkAway: WalkAwayPoint[];
  /** P10-compatible map: month_6, month_12, month_24, month_36, month_60. */
  walkAwayCost: Record<string, number>;
  /** First month where resale ≥ balance (equity ≥ 0), or null within the term. */
  positiveEquityMonth: number | null;
  /** Legacy alias of positiveEquityMonth; kept until every caller moves. */
  evenMonth: number | null;
  /** Legacy alias of positiveEquityMonth; kept until every caller moves. */
  underwaterMonth: number | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function monthlyPayment(
  principal: number,
  aprPercent: number,
  termMonths: number,
): number {
  if (principal <= 0) return 0;
  const r = aprPercent / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

export function balanceAt(
  principal: number,
  aprPercent: number,
  termMonths: number,
  t: number,
): number {
  if (t <= 0) return principal;
  if (t >= termMonths) return 0;
  const p = monthlyPayment(principal, aprPercent, termMonths);
  const r = aprPercent / 100 / 12;
  if (r === 0) return Math.max(0, principal - p * t);
  const growth = Math.pow(1 + r, t);
  return principal * growth - (p * (growth - 1)) / r;
}

export function resaleAt(
  price: number,
  retention5yAdjusted: number,
  tMonths: number,
): number {
  if (tMonths <= 0) return price * TRADE_IN_FACTOR;
  const retail = Math.min(
    1,
    Math.max(0.01, retention5yAdjusted / TRADE_IN_FACTOR),
  );
  return price * TRADE_IN_FACTOR * Math.pow(retail, tMonths / 60);
}

export function ownershipMath(input: OwnershipInput): OwnershipResult {
  const price = input.price;
  if (!(price > 0)) throw new Error("price must be positive");
  const downPayment = input.down ?? price * 0.1;
  const aprPercent = input.apr ?? DEFAULT_APR_PERCENT;
  const termMonths = input.term ?? DEFAULT_TERM_MONTHS;
  const retention5y = input.retention5y ?? DEFAULT_RETENTION_5Y;
  const taxAmount = Math.max(0, input.tax ?? 0);
  const loanAmount = Math.max(0, price + taxAmount - downPayment);
  const payment = monthlyPayment(loanAmount, aprPercent, termMonths);

  const pointAt = (month: number): WalkAwayPoint => {
    const balance = balanceAt(loanAmount, aprPercent, termMonths, month);
    const resale = resaleAt(price, retention5y, month);
    const equity = resale - balance;
    const cost = downPayment + payment * month - equity;
    const per = month > 0 ? round2(cost / month) : round2(cost);
    return {
      month,
      getBack: round2(equity),
      costPerMonth: per,
      walkAwayCost: round2(cost),
      perMonth: per,
      balance: round2(balance),
      resale: round2(resale),
      equity: round2(equity),
    };
  };

  const curve: CurvePoint[] = [];
  for (let m = 0; m <= 60; m += 1) {
    const resale = resaleAt(price, retention5y, m);
    const balance = balanceAt(loanAmount, aprPercent, termMonths, m);
    curve.push({
      month: m,
      resale: round2(resale),
      balance: round2(balance),
      equity: round2(resale - balance),
    });
  }

  const monthly: WalkAwayPoint[] = [];
  for (let m = 0; m <= 60; m += 1) monthly.push(pointAt(m));

  const walkAway = WALK_AWAY_MONTHS.map(pointAt);
  const walkAwayCost: Record<string, number> = {};
  for (const p of walkAway) walkAwayCost[`month_${p.month}`] = p.walkAwayCost;

  let positiveEquityMonth: number | null = null;
  for (let t = 0; t <= termMonths; t += 1) {
    const balance = balanceAt(loanAmount, aprPercent, termMonths, t);
    const resale = resaleAt(price, retention5y, t);
    if (resale >= balance) {
      positiveEquityMonth = t;
      break;
    }
  }

  return {
    model: input.model ?? null,
    price,
    taxAmount: round2(taxAmount),
    downPayment: round2(downPayment),
    loanAmount: round2(loanAmount),
    aprPercent,
    termMonths,
    retention5y,
    monthlyPayment: round2(payment),
    curve,
    monthly,
    walkAway,
    walkAwayCost,
    positiveEquityMonth,
    evenMonth: positiveEquityMonth,
    underwaterMonth: positiveEquityMonth,
  };
}
