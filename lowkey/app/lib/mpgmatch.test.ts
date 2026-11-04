import { describe, expect, it } from "vitest";

import { matchUnitMpg, parseEngine, type EpaVariant } from "./mpgmatch";

// Shapes from the table's epaVariants (2026 Toyota 4Runner-like and
// Honda CR-V Hybrid rows from the EPA vehicles.csv).
const v = (
  epaId: string,
  drive: string[],
  displ: number,
  cyl: number,
  turbo: boolean,
  mpg: number,
  hybrid = false,
  year = 2026,
): EpaVariant => ({ epaId, year, drive, displ, cyl, turbo, hybrid, mpg });

const RUNNER = [
  v("1", ["RWD"], 2.4, 4, true, 22),
  v("2", ["4WD"], 2.4, 4, true, 21),
  v("3", ["4WD"], 2.4, 4, true, 23, true),
];
const CRV_HYBRID = [
  v("49353", ["FWD"], 2.0, 4, false, 40, true),
  v("49488", ["AWD"], 2.0, 4, false, 37, true),
  v("49489", ["AWD"], 2.0, 4, false, 35, true),
];

describe("parseEngine", () => {
  it("reads displacement, cylinders and turbo", () => {
    expect(parseEngine("2.4L I4 Turbo")).toEqual({ displ: 2.4, cyl: 4, turbo: true });
    expect(parseEngine("3.5L V6")).toEqual({ displ: 3.5, cyl: 6, turbo: false });
    expect(parseEngine(null)).toBeNull();
  });
});

describe("matchUnitMpg", () => {
  it("exact match by year, drivetrain, powertrain and engine", () => {
    const m = matchUnitMpg(
      { year: 2026, drivetrain: "4WD", engine: "2.4L I4 Turbo", cylinders: 4, powertrain: "Combustion" },
      RUNNER,
      22,
    );
    expect(m).toEqual({ mpg: 21, level: "engine", epaId: "2" });
  });

  it("drivetrain-only match when the listing gives no engine", () => {
    // AWD CR-V Hybrid: 37 and 35 agree within 2 MPG; the lower is used.
    const m = matchUnitMpg({ year: 2026, drivetrain: "AWD", powertrain: "HEV" }, CRV_HYBRID, 37);
    expect(m).toEqual({ mpg: 35, level: "drivetrain", epaId: "49489" });
    const fwd = matchUnitMpg({ year: 2026, drivetrain: "FWD" }, CRV_HYBRID, 37);
    expect(fwd).toEqual({ mpg: 40, level: "drivetrain", epaId: "49353" });
  });

  it("no confident match falls back to the typical figure", () => {
    // Unknown year, an engine not in the variants, and no drivetrain.
    expect(matchUnitMpg({ year: 2027, drivetrain: "4WD" }, RUNNER, 21)).toEqual({
      mpg: 21,
      level: "typical",
      epaId: null,
    });
    expect(
      matchUnitMpg({ year: 2026, drivetrain: "4WD", engine: "3.4L V6 Turbo" }, RUNNER, 21)?.level,
    ).toBe("typical");
    expect(matchUnitMpg({ year: 2026 }, RUNNER, 21)?.level).toBe("typical");
  });

  it("candidates that disagree by more than 2 MPG are not confident", () => {
    const wide = [v("a", ["AWD"], 2.0, 4, false, 40), v("b", ["AWD"], 2.0, 4, false, 30)];
    expect(matchUnitMpg({ year: 2026, drivetrain: "AWD" }, wide, 33)?.level).toBe("typical");
  });

  it("no typical figure and no match means no number", () => {
    expect(matchUnitMpg({ year: 2027, drivetrain: "4WD" }, RUNNER, null)).toBeNull();
  });
});
