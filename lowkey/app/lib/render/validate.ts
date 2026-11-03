import type { Spec } from "@json-render/core";

import { catalog } from "./catalog";

/**
 * Catalog (Zod) validation for a spec (task 034). Client-side only:
 * the catalog pulls in the React renderer package, so the server
 * route runs the pure number guard (guard.ts) and the page runs
 * this plus the guard before anything renders.
 */
export function isCatalogValid(spec: Spec): boolean {
  return catalog.validate(spec).success;
}
