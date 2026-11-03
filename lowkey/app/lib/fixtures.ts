/**
 * SAMPLE DATA — stub fixtures for task 025. Numbers echo the
 * committed four-pick lineups in lowkey/docs/preflight-results.md
 * (task 023/024) so the scaffold shows realistic cards. Real data
 * comes in a later task; nothing here is a live price.
 */

export type Category = "Sedan" | "SUV" | "Pickup";

export interface FixturePick {
  rank: number | null;
  make: string;
  model: string;
  price: number;
  /** 5-year retention after the 15% trade-in discount. */
  retention5y: number;
  depPerMonth: number;
  flag?: "badge" | "extra";
}

export interface RankFixture {
  category: Category;
  picks: FixturePick[];
  commodity: FixturePick & { flag: "badge" | "extra" };
}

const SEDAN: RankFixture = {
  category: "Sedan",
  picks: [
    { rank: 1, make: "Honda", model: "Accord Sedan", price: 31472, retention5y: 0.656, depPerMonth: 180 },
    { rank: 2, make: "Honda", model: "Civic Sedan", price: 28180, retention5y: 0.653, depPerMonth: 163 },
    { rank: 3, make: "Mazda", model: "Mazda3 Sedan", price: 27387, retention5y: 0.623, depPerMonth: 172 },
    { rank: 4, make: "Hyundai", model: "Elantra", price: 24860, retention5y: 0.599, depPerMonth: 166 },
  ],
  commodity: { rank: 2, make: "Honda", model: "Civic Sedan", price: 28180, retention5y: 0.653, depPerMonth: 163, flag: "badge" },
};

const SUV: RankFixture = {
  category: "SUV",
  picks: [
    { rank: 1, make: "Honda", model: "CR-V", price: 34899, retention5y: 0.629, depPerMonth: 216 },
    { rank: 2, make: "Toyota", model: "Corolla Cross", price: 32783, retention5y: 0.623, depPerMonth: 206 },
    { rank: 3, make: "Mazda", model: "CX-50", price: 35718, retention5y: 0.596, depPerMonth: 241 },
    { rank: 4, make: "Toyota", model: "4Runner", price: 58416, retention5y: 0.585, depPerMonth: 404 },
  ],
  commodity: { rank: null, make: "Hyundai", model: "Venue", price: 24856, retention5y: 0.575, depPerMonth: 176, flag: "extra" },
};

const PICKUP: RankFixture = {
  category: "Pickup",
  picks: [
    { rank: 1, make: "Toyota", model: "Tacoma", price: 46039, retention5y: 0.633, depPerMonth: 281 },
    { rank: 2, make: "Ram", model: "1500", price: 55801, retention5y: 0.609, depPerMonth: 364 },
    { rank: 3, make: "Chevrolet", model: "Colorado", price: 42691, retention5y: 0.564, depPerMonth: 310 },
    { rank: 4, make: "Chevrolet", model: "Silverado 1500", price: 51541, retention5y: 0.56, depPerMonth: 378 },
  ],
  commodity: { rank: null, make: "Ford", model: "Maverick", price: 35509, retention5y: 0.554, depPerMonth: 264, flag: "extra" },
};

export const RANK_FIXTURES: Record<Category, RankFixture> = {
  Sedan: SEDAN,
  SUV,
  Pickup: PICKUP,
};

export function retentionForModel(model: string): number | undefined {
  for (const fixture of Object.values(RANK_FIXTURES)) {
    for (const pick of [...fixture.picks, fixture.commodity]) {
      if (pick.model === model) return pick.retention5y;
    }
  }
  return undefined;
}

export interface SampleUnit {
  dealer: string;
  distanceMiles: number;
  price: number;
  url: string;
}

/** Deterministic sample units near any ZIP (stub: ZIP is echoed, not searched). */
export function sampleUnitsFor(model: string, basePrice: number): SampleUnit[] {
  const slug = model.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return [
    { dealer: "Sample Motors North", distanceMiles: 4.2, price: basePrice, url: `https://example.com/lowkey-sample/${slug}-1` },
    { dealer: "Sample Motors West", distanceMiles: 9.6, price: basePrice + 350, url: `https://example.com/lowkey-sample/${slug}-2` },
    { dealer: "Sample Motors South", distanceMiles: 14.8, price: basePrice + 700, url: `https://example.com/lowkey-sample/${slug}-3` },
  ];
}

export function priceForModel(model: string): number | undefined {
  for (const fixture of Object.values(RANK_FIXTURES)) {
    for (const pick of [...fixture.picks, fixture.commodity]) {
      if (pick.model === model) return pick.price;
    }
  }
  return undefined;
}
