import { describe, expect, it } from "vitest";

import { resolveTablePick, type LowkeyTable, type TablePick } from "./table";

const pick = (model: string, make: string, mpg: number): TablePick =>
  ({ rank: 1, make, model, providerModel: model, mpg }) as unknown as TablePick;
const lineup = (category: string, picks: TablePick[]) => ({
  category,
  picks,
  commodity: null,
  commodityFlag: null,
  makes: [],
  soldTotal: 0,
});

const table = {
  lineups: {
    Sedan: lineup("Sedan", [pick("Civic Sedan", "Honda", 36)]),
    SUV: lineup("SUV", [pick("CR-V", "Honda", 29)]),
    Pickup: lineup("Pickup", [pick("1500", "Ram", 20)]),
    Hybrid: lineup("Hybrid", [pick("CR-V", "Honda", 37)]),
  },
} as unknown as LowkeyTable;

describe("resolveTablePick with a category (task 042)", () => {
  it("finds the hybrid CR-V in Hybrid and the gas CR-V in SUV", () => {
    expect(resolveTablePick(table, "CR-V", "Hybrid")).toMatchObject({ category: "Hybrid", pick: { mpg: 37 } });
    expect(resolveTablePick(table, "Honda CR-V", "SUV")).toMatchObject({ category: "SUV", pick: { mpg: 29 } });
  });

  it("keeps the old behaviour without a category", () => {
    expect(resolveTablePick(table, "CR-V")?.category).toBe("SUV");
    expect(resolveTablePick(table, "Civic Sedan", "Hybrid")?.category).toBe("Sedan");
  });
});
