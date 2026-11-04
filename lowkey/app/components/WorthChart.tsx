"use client";

export interface CurveLike {
  month: number;
  resale: number;
  balance: number;
  /** resale − balance; absent on old tool outputs (derived then). */
  equity?: number;
}

/* Equity charts (task 039): one rising equity line on Iconiq theme
   tokens — green "yours" fill above zero (--chart-yours), a thin
   muted band below zero, a zero line and a dot at the crossing.
   The Iconiq `charts` (Recharts) shell was not used: the exact
   zero-crossing fill and dot are direct SVG. */
const INK = "var(--chart-2)";
const GREEN_FILL = "var(--chart-yours)";
const GREEN_TEXT = "var(--chart-yours-text)";
const CARD = "var(--card)";
const GRID = "var(--border)";
const MUTED = "var(--muted-foreground)";
const MUTED_FILL = "var(--border)";
const SANS = "var(--font-sans)";
const MONO = "var(--font-mono)";

/** Equity of one point; old outputs without equity derive it. */
export function equityOf(p: CurveLike): number {
  return p.equity ?? p.resale - p.balance;
}

/** Interpolated zero crossing of the equity line, or null. */
function equityCrossing(
  curve: CurveLike[],
  x: (m: number) => number,
): { cx: number; month: number } | null {
  for (let i = 0; i < curve.length; i += 1) {
    const e = equityOf(curve[i]!);
    if (e < 0) continue;
    if (i === 0) return { cx: x(curve[0]!.month), month: curve[0]!.month };
    const prev = curve[i - 1]!;
    const ePrev = equityOf(prev);
    const span = e - ePrev;
    const frac = span === 0 ? 0 : (0 - ePrev) / span;
    const m = prev.month + frac * (curve[i]!.month - prev.month);
    return { cx: x(m), month: m };
  }
  return null;
}

function equityLinePoints(
  curve: CurveLike[],
  x: (m: number) => number,
  y: (v: number) => number,
): string {
  return curve
    .map((p) => `${x(p.month).toFixed(1)},${y(equityOf(p)).toFixed(1)}`)
    .join(" ");
}

/** Area between the equity line and zero, split at the crossing. */
function equityAreas(
  curve: CurveLike[],
  x: (m: number) => number,
  y: (v: number) => number,
  yZero: number,
): { above: string | null; below: string | null; crossX: number | null } {
  const cross = equityCrossing(curve, x);
  const pts = curve.map((p) => ({
    mx: x(p.month),
    my: y(equityOf(p)),
    e: equityOf(p),
  }));
  const lineTo = (list: { mx: number; my: number }[]) =>
    list.map((p) => `${p.mx.toFixed(1)},${p.my.toFixed(1)}`).join(" L");
  if (cross === null) {
    if (pts.length < 2) return { above: null, below: null, crossX: null };
    const below = `M${lineTo(pts)} L${pts[pts.length - 1]!.mx.toFixed(1)},${yZero.toFixed(1)} L${pts[0]!.mx.toFixed(1)},${yZero.toFixed(1)} Z`;
    return { above: null, below, crossX: null };
  }
  const after = pts.filter((p) => p.e >= 0);
  const before = pts.filter((p) => p.e < 0);
  let above: string | null = null;
  let below: string | null = null;
  if (after.length > 0) {
    const top = [{ mx: cross.cx, my: yZero }, ...after];
    above = `M${lineTo(top)} L${after[after.length - 1]!.mx.toFixed(1)},${yZero.toFixed(1)} L${cross.cx.toFixed(1)},${yZero.toFixed(1)} Z`;
  }
  if (before.length > 0) {
    const top = [...before, { mx: cross.cx, my: yZero }];
    below = `M${lineTo(top)} L${cross.cx.toFixed(1)},${yZero.toFixed(1)} L${before[0]!.mx.toFixed(1)},${yZero.toFixed(1)} Z`;
  }
  return { above, below, crossX: cross.cx };
}

/** Small single-line equity chart for a card: zero line, fills, dot. */
export function EquityMiniChart({
  curve,
  positiveEquityMonth,
}: {
  curve: CurveLike[];
  positiveEquityMonth: number | null;
}) {
  const W = 120;
  const H = 44;
  const pad = 3;
  const equities = curve.map(equityOf);
  const minE = Math.min(0, ...equities);
  const maxE = Math.max(0, ...equities);
  const span = maxE - minE || 1;
  const x = (m: number) => pad + (m / 60) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - minE) / span) * (H - pad * 2);
  const yZero = y(0);
  const hasPositive = positiveEquityMonth !== null;
  const { above, below, crossX } = equityAreas(curve, x, y, yZero);
  const abovePath = hasPositive ? above : null;
  const lineColor = hasPositive ? GREEN_TEXT : MUTED;
  const aria =
    positiveEquityMonth === null
      ? "Your equity over 60 months. Equity stays below zero for the loan."
      : positiveEquityMonth <= 0
        ? "Your equity over 60 months. Positive equity from day one."
        : `Your equity over 60 months. Positive equity by month ${positiveEquityMonth}.`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={aria}
      style={{ display: "block" }}
    >
      {below ? <path d={below} style={{ fill: MUTED_FILL }} fillOpacity={0.7} /> : null}
      {abovePath ? <path d={abovePath} style={{ fill: GREEN_FILL }} fillOpacity={0.8} /> : null}
      <line x1={pad} x2={W - pad} y1={yZero} y2={yZero} style={{ stroke: MUTED }} strokeWidth={1} />
      <polyline
        points={equityLinePoints(curve, x, y)}
        fill="none"
        style={{ stroke: lineColor }}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {hasPositive && crossX !== null ? (
        <circle cx={crossX} cy={yZero} r={3.2} style={{ fill: CARD, stroke: GREEN_TEXT }} strokeWidth={1.6} />
      ) : null}
    </svg>
  );
}

/** Full equity chart (task 039): one line, zero line, fills, slider marker. */
export function FullChart({
  curve,
  positiveEquityMonth,
  selectedMonth,
}: {
  curve: CurveLike[];
  positiveEquityMonth: number | null;
  selectedMonth: number;
}) {
  const W = 320;
  const H = 200;
  const left = 44;
  const right = 312;
  const top = 14;
  const bottom = 176;
  const equities = curve.map(equityOf);
  const step = 5000;
  const yMin = Math.min(0, Math.floor(Math.min(...equities) / step) * step);
  const yMax = Math.max(step, Math.ceil(Math.max(...equities) / step) * step);
  const x = (m: number) => left + (m / 60) * (right - left);
  const y = (v: number) => bottom - ((v - yMin) / (yMax - yMin)) * (bottom - top);
  const yZero = y(0);
  const ticks: number[] = [];
  const tickStep = yMax - yMin > 30000 ? 10000 : step;
  for (let v = Math.ceil(yMin / tickStep) * tickStep; v <= yMax; v += tickStep) ticks.push(v);
  const xTicks = [0, 12, 24, 36, 48, 60];
  const hasPositive = positiveEquityMonth !== null;
  const { above, below, crossX } = equityAreas(curve, x, y, yZero);
  const sel = curve[selectedMonth] ?? curve[curve.length - 1]!;
  const selE = equityOf(sel);
  const selX = x(sel.month);
  const selLabel = `${selE < 0 ? "-" : "+"}$${Math.abs(Math.round(selE)).toLocaleString("en-US")}`;
  const selColor = selE < 0 ? MUTED : GREEN_TEXT;
  // "Your equity" sits in the green area away from the slider marker.
  const labelMonth = selectedMonth > 40 ? Math.max((positiveEquityMonth ?? 0) + 8, 26) : 52;
  const midPt = curve[Math.min(60, labelMonth)];
  const yoursY = yZero - 8;
  const aria =
    positiveEquityMonth === null
      ? "Your equity over 60 months. Equity stays below zero for the loan."
      : positiveEquityMonth <= 0
        ? "Your equity over 60 months. Positive equity from day one."
        : `Your equity over 60 months. Positive equity by month ${positiveEquityMonth}.`;
  const kLabel = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v) / 1000}k`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={aria}
      style={{ display: "block" }}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line x1={left} x2={right} y1={y(v)} y2={y(v)} style={{ stroke: GRID }} strokeWidth={1} />
          <text x={left - 6} y={y(v) + 4} textAnchor="end" fontSize={10} style={{ fill: MUTED, fontFamily: MONO }}>
            {v === 0 ? "$0" : kLabel(v)}
          </text>
        </g>
      ))}
      {xTicks.map((m) => (
        <text key={m} x={x(m)} y={192} textAnchor="middle" fontSize={10} style={{ fill: MUTED, fontFamily: MONO }}>
          {m}
        </text>
      ))}
      {below ? <path d={below} style={{ fill: MUTED_FILL }} fillOpacity={0.7} /> : null}
      {hasPositive && above ? <path d={above} style={{ fill: GREEN_FILL }} fillOpacity={0.8} /> : null}
      <line x1={left} x2={right} y1={yZero} y2={yZero} style={{ stroke: MUTED }} strokeWidth={1.2} />
      <polyline
        points={equityLinePoints(curve, x, y)}
        fill="none"
        style={{ stroke: hasPositive ? GREEN_TEXT : MUTED }}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {hasPositive && above && midPt ? (
        <text x={x(Math.min(60, labelMonth))} y={Math.max(top + 10, yoursY)} textAnchor="middle" fontSize={11} fontWeight={600} style={{ fill: GREEN_TEXT, fontFamily: SANS }}>
          Your equity
        </text>
      ) : null}
      {hasPositive && crossX !== null && (positiveEquityMonth ?? 0) > 0 ? (
        <>
          <circle cx={crossX} cy={yZero} r={5} style={{ fill: CARD, stroke: GREEN_TEXT }} strokeWidth={2} />
          <text x={Math.min(right - 60, crossX + 8)} y={Math.min(bottom - 4, yZero + 16)} fontSize={11} fontWeight={600} style={{ fill: INK, fontFamily: SANS }}>
            {`month ${positiveEquityMonth}`}
          </text>
        </>
      ) : null}
      <line x1={selX} x2={selX} y1={top} y2={bottom} style={{ stroke: INK }} strokeWidth={1.5} />
      <circle cx={selX} cy={y(selE)} r={4.5} style={{ fill: selE < 0 ? MUTED : GREEN_TEXT }} />
      <text
        x={selX > 180 ? selX - 8 : selX + 8}
        y={Math.max(top + 10, y(selE) - 12)}
        textAnchor={selX > 180 ? "end" : "start"}
        fontSize={11}
        fontWeight={600}
        style={{ fill: selColor, fontFamily: MONO }}
      >
        {selLabel}
      </text>
    </svg>
  );
}
