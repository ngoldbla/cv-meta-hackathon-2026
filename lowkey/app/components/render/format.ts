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
};

export const SEGMENT_LABEL: Record<string, string> = {
  loan: "Loan",
  gas: "Gas",
  valueLost: "Value lost",
  interest: "Interest",
};

/** Hatched "back to you" fill (mockup greens through tokens). */
export const BACK_FILL =
  "repeating-linear-gradient(135deg, var(--cost-back-a) 0 6px, var(--cost-back-b) 6px 12px)";
