/**
 * Car types (tasks 022 and 042). Mirrors lowkey/preflight/categories.py:
 * Sedan, SUV and Pickup are body types under the strict gas filter;
 * Minivan is the Minivan body, gas or full hybrid, whichever the
 * model is sold as; Hybrid is full hybrids (HEV) across any body.
 * Electric was dropped (Dylan, 2026-11-03); plug-in hybrids are out
 * of scope.
 */

export const CATEGORIES = ["Sedan", "SUV", "Pickup", "Minivan", "Hybrid"] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

/** Provider listing filters that define one category's new stock. */
export function listingFilters(category: Category): Record<string, string> {
  switch (category) {
    case "Minivan":
      return { body_type: "Minivan", exclude_powertrain_type: "PHEV,BEV,FCEV,MHEV" };
    case "Hybrid":
      return { powertrain_type: "HEV" };
    default:
      return { fuel_type: "Gas only", exclude_powertrain_type: "MHEV,HEV" };
  }
}

const PLURAL: Record<Category, string> = {
  Sedan: "sedans",
  SUV: "SUVs",
  Pickup: "pickups",
  Minivan: "minivans",
  Hybrid: "hybrids",
};

/** "SUVs", "minivans", "hybrids". */
export function categoryPlural(category: string): string {
  return isCategory(category) ? PLURAL[category] : category;
}

/** "SUV", "minivan", "hybrid" (in-sentence noun). */
export function categoryNoun(category: string): string {
  return category === "SUV" ? "SUV" : category.toLowerCase();
}

/** The ranking step's label: "Comparing gas SUVs", "Comparing hybrids". */
export function comparingLabel(category: string): string {
  const gas = category === "Sedan" || category === "SUV" || category === "Pickup";
  return `Comparing ${gas ? "gas " : ""}${categoryPlural(category)} by 5-year resale`;
}
