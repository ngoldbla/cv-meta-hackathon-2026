import { tool } from "ai";
import { z } from "zod";

import {
  RANK_FIXTURES,
  priceForModel,
  resolvePick,
  retentionForModel,
  sampleUnitsFor,
  type Category,
} from "./fixtures";
import { ownershipMath } from "./ownership";

/**
 * Stub tools (task 025). Shapes follow the PRD and task 023's P10
 * definitions. rank_category and local_units return SAMPLE DATA
 * fixtures; ownership_math runs the real deterministic maths in
 * lib/ownership.ts — only its inputs are stubbed by the caller.
 */

export const rankCategoryTool = tool({
  description:
    "Return the ranked picks (at most 4) and the commodity pick for a category. Sample data in this scaffold.",
  inputSchema: z.object({
    category: z.enum(["Sedan", "SUV", "Pickup"]),
  }),
  execute: async ({ category }: { category: Category }) => {
    const fixture = RANK_FIXTURES[category];
    return {
      sampleData: true as const,
      category: fixture.category,
      picks: fixture.picks,
      commodity: fixture.commodity,
      note: "SAMPLE DATA: fixture lineups, not live prices.",
    };
  },
});

export const ownershipMathTool = tool({
  description:
    "Return the monthly payment, walk-away costs at 6, 12, 24, 36 and 60 months, and the underwater (above-water) month for a price, down payment, APR and term. Deterministic; never estimate these numbers in text.",
  inputSchema: z.object({
    price: z.number().positive(),
    down: z.number().nonnegative().optional(),
    apr: z.number().nonnegative().optional(),
    term: z.number().int().positive().optional(),
    model: z.string().optional(),
  }),
  execute: async ({
    price,
    down,
    apr,
    term,
    model,
  }: {
    price: number;
    down?: number;
    apr?: number;
    term?: number;
    model?: string;
  }) => {
    const resolved = model ? resolvePick(model) : undefined;
    const result = ownershipMath({
      price,
      down,
      apr,
      term,
      // Canonical fixture model ("CR-V") so the UI can attach this
      // result to the ranked card even when the caller sent
      // "Honda CR-V".
      model: resolved?.model ?? model,
      retention5y: model ? retentionForModel(model) : undefined,
    });
    return {
      sampleData: true as const,
      ...result,
      make: resolved?.make ?? null,
    };
  },
});

export const localUnitsTool = tool({
  description:
    "Return new in-stock sample units near a ZIP code for a model. Sample data in this scaffold.",
  inputSchema: z.object({
    zip: z.string(),
    model: z.string().optional(),
    category: z.string().optional(),
    radius: z.number().int().positive().optional(),
  }),
  execute: async ({
    zip,
    model,
    category,
    radius,
  }: {
    zip: string;
    model?: string;
    category?: string;
    radius?: number;
  }) => {
    const resolved = model ? resolvePick(model) : undefined;
    const basePrice = model ? priceForModel(model) : undefined;
    if (!model || !resolved || basePrice === undefined) {
      return {
        sampleData: true as const,
        zip,
        model: model ?? null,
        category: category ?? null,
        radius: radius ?? 50,
        unitsFound: 0,
        units: [],
        note: "SAMPLE DATA: name a model from rank_category to see sample units.",
      };
    }
    const units = sampleUnitsFor(resolved.model, basePrice);
    const best = units.reduce((a, b) => (b.price < a.price ? b : a));
    return {
      sampleData: true as const,
      zip,
      model: resolved.model,
      make: resolved.make,
      category: category ?? null,
      radius: radius ?? 50,
      unitsFound: units.length,
      bestPrice: best.price,
      bestDealer: best.dealer,
      units,
      note: "SAMPLE DATA: fixture units, not live stock.",
    };
  },
});

export const lowkeyTools = {
  rank_category: rankCategoryTool,
  ownership_math: ownershipMathTool,
  local_units: localUnitsTool,
};
