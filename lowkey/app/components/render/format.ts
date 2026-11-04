const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Whole dollars as on the cards ("$577"). Spec amounts are already whole. */
export function fmtUsd(n: number): string {
  return usd0.format(Math.round(n));
}

/** Segment colours through theme tokens (mockup hexes in globals.css). */
export const SEGMENT_COLOR: Record<string, string> = {
  loan: "var(--cost-loan)",
  gas: "var(--cost-gas)",
  valueLost: "var(--cost-lost)",
  interest: "var(--cost-interest)",
  tax: "var(--cost-tax)",
};

export const SEGMENT_LABEL: Record<string, string> = {
  loan: "Loan",
  gas: "Gas",
  valueLost: "Value lost",
  interest: "Interest",
  tax: "Sales tax",
};

/**
 * The "back to you" fill (task 055: was a hatched stripe pattern). A solid
 * green tint with a dashed edge, so it reads apart from the cost segments
 * by its edge as well as its colour, in light and dark.
 */
export const BACK_FILL = "var(--cost-back-b)";
export const BACK_EDGE = "border border-dashed border-[var(--cost-back-ink)]";
