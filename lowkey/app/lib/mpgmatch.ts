/**
 * MPG per unit, not per model (task 042, part 2b). The table keeps a
 * small list of EPA variants per pick (model years around the current
 * one, the category's powertrain); a local unit is matched to them by
 * year, drivetrain, powertrain and engine (displacement, cylinders,
 * turbo) when the listing gives them. EPA combined MPG throughout
 * (55% city / 45% highway).
 *
 * Confidence: the candidates left after matching must agree within
 * MPG_SPAN (2 MPG); the lowest of them is used, so the estimate is
 * never the optimistic one. No confident match means the model's
 * table figure, labelled "typical MPG".
 */

export interface EpaVariant {
  epaId: string;
  year: number;
  /** Listing drivetrain codes this EPA drive covers (FWD, RWD, AWD, 4WD). */
  drive: string[];
  displ: number | null;
  cyl: number | null;
  turbo: boolean;
  hybrid: boolean;
  mpg: number;
}

export interface UnitSpec {
  year?: number | null;
  drivetrain?: string | null;
  engine?: string | null;
  cylinders?: number | null;
  powertrain?: string | null;
}

export type MpgMatchLevel = "engine" | "drivetrain" | "typical";

export interface MpgMatch {
  mpg: number;
  level: MpgMatchLevel;
  epaId: string | null;
}

export const MPG_SPAN = 2;

/** "2.4L I4 Turbo" -> { displ: 2.4, cyl: 4, turbo: true }. */
export function parseEngine(
  engine: string | null | undefined,
): { displ: number | null; cyl: number | null; turbo: boolean } | null {
  if (!engine) return null;
  const displ = /(\d+(?:\.\d+)?)\s*L\b/i.exec(engine);
  const cyl = /\b[IVHW](\d{1,2})\b/i.exec(engine);
  if (!displ && !cyl) return null;
  return {
    displ: displ ? Number(displ[1]) : null,
    cyl: cyl ? Number(cyl[1]) : null,
    turbo: /turbo|supercharg/i.test(engine),
  };
}

function confident(cands: EpaVariant[], level: MpgMatchLevel): MpgMatch | null {
  if (cands.length === 0) return null;
  const mpgs = cands.map((c) => c.mpg);
  if (Math.max(...mpgs) - Math.min(...mpgs) > MPG_SPAN) return null;
  const best = cands.reduce((a, b) => (b.mpg < a.mpg ? b : a));
  return { mpg: best.mpg, level, epaId: best.epaId };
}

export function matchUnitMpg(
  unit: UnitSpec,
  variants: EpaVariant[] | null | undefined,
  typicalMpg: number | null | undefined,
): MpgMatch | null {
  const typical: MpgMatch | null =
    typicalMpg && typicalMpg > 0 ? { mpg: typicalMpg, level: "typical", epaId: null } : null;
  const drive = unit.drivetrain?.trim().toUpperCase() ?? "";
  if (!variants?.length || !unit.year || !drive) return typical;
  let cands = variants.filter((v) => v.year === unit.year && v.drive.includes(drive));
  const pt = unit.powertrain?.trim().toUpperCase();
  if (pt === "HEV") cands = cands.filter((v) => v.hybrid);
  else if (pt === "COMBUSTION") cands = cands.filter((v) => !v.hybrid);
  const engine = parseEngine(unit.engine);
  const cyl = unit.cylinders ?? engine?.cyl ?? null;
  if (engine || cyl !== null) {
    const byEngine = cands.filter(
      (v) =>
        (engine?.displ == null || (v.displ !== null && Math.abs(v.displ - engine.displ) < 0.05)) &&
        (cyl === null || v.cyl === cyl) &&
        (engine === null || v.turbo === engine.turbo),
    );
    // The listing names an engine: it must match one, or the match
    // is not confident (the unit's engine is not in the variants).
    return confident(byEngine, "engine") ?? typical;
  }
  return confident(cands, "drivetrain") ?? typical;
}
