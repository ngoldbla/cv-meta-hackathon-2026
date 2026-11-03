"use client";

export interface CurveLike {
  month: number;
  resale: number;
  balance: number;
}

const GOLD = "#7A5A10";
const INK = "#1B1C1E";
const WARM_FILL = "#E9B8A4";
const GREEN_FILL = "#BFD6C4";
const WARM_TEXT = "#8A3B1E";
const GREEN_TEXT = "#2E5E3A";

function pointsAttr(
  curve: CurveLike[],
  key: "resale" | "balance",
  x: (m: number) => number,
  y: (v: number) => number,
): string {
  return curve.map((p) => `${x(p.month).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
}

function gapPath(
  curve: CurveLike[],
  from: number,
  to: number,
  x: (m: number) => number,
  y: (v: number) => number,
): string | null {
  const seg = curve.filter((p) => p.month >= from && p.month <= to);
  if (seg.length < 2) return null;
  const top = seg.map((p) => `${x(p.month).toFixed(1)},${y(p.resale).toFixed(1)}`);
  const bottom = [...seg]
    .reverse()
    .map((p) => `${x(p.month).toFixed(1)},${y(p.balance).toFixed(1)}`);
  return `M${top.join(" L")} L${bottom.join(" L")} Z`;
}

/** Small worth-vs-owe chart for a card: no axes, gap + crossing dot. */
export function MiniChart({
  curve,
  evenMonth,
}: {
  curve: CurveLike[];
  evenMonth: number | null;
}) {
  const W = 120;
  const H = 44;
  const pad = 3;
  const maxV = Math.max(...curve.map((p) => Math.max(p.resale, p.balance)), 1);
  const x = (m: number) => pad + (m / 60) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / maxV) * (H - pad * 2);
  const cross = evenMonth !== null ? curve[evenMonth] : undefined;
  const underEnd = evenMonth ?? 60;
  const under = gapPath(curve, 0, underEnd, x, y);
  const yours = evenMonth !== null ? gapPath(curve, evenMonth, 60, x, y) : null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Worth if sold versus what you owe over 60 months"
      style={{ display: "block" }}
    >
      {under ? <path d={under} fill={WARM_FILL} fillOpacity={0.75} /> : null}
      {yours ? <path d={yours} fill={GREEN_FILL} fillOpacity={0.8} /> : null}
      <polyline
        points={pointsAttr(curve, "balance", x, y)}
        fill="none"
        stroke={INK}
        strokeWidth={1.8}
        strokeDasharray="4 3"
      />
      <polyline
        points={pointsAttr(curve, "resale", x, y)}
        fill="none"
        stroke={GOLD}
        strokeWidth={2}
      />
      {cross ? (
        <circle cx={x(cross.month)} cy={y(cross.resale)} r={3.2} fill="#FFFFFF" stroke={INK} strokeWidth={1.6} />
      ) : null}
    </svg>
  );
}

/** Full worth-vs-owe chart with axes, fills and slider marker. */
export function FullChart({
  curve,
  evenMonth,
  selectedMonth,
  selectedGetBack,
}: {
  curve: CurveLike[];
  evenMonth: number | null;
  selectedMonth: number;
  selectedGetBack: number;
}) {
  const W = 320;
  const H = 200;
  const left = 40;
  const right = 312;
  const top = 14;
  const bottom = 176;
  const maxRaw = Math.max(...curve.map((p) => Math.max(p.resale, p.balance)), 10000);
  const yMax = Math.ceil(maxRaw / 10000) * 10000;
  const x = (m: number) => left + (m / 60) * (right - left);
  const y = (v: number) => bottom - (v / yMax) * (bottom - top);
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += 10000) ticks.push(v);
  const xTicks = [0, 12, 24, 36, 48, 60];
  const underEnd = evenMonth ?? 60;
  const under = gapPath(curve, 0, underEnd, x, y);
  const yours = evenMonth !== null ? gapPath(curve, evenMonth, 60, x, y) : null;
  const cross = evenMonth !== null ? curve[evenMonth] : undefined;
  const sel = curve[selectedMonth] ?? curve[curve.length - 1];
  const selX = x(sel.month);
  const backLabel = `${selectedGetBack < 0 ? "-" : "+"}$${Math.abs(Math.round(selectedGetBack)).toLocaleString("en-US")}`;
  const backColor = selectedGetBack < 0 ? WARM_TEXT : GREEN_TEXT;
  const aria = `Worth if sold versus loan balance over 60 months. The lines cross at month ${evenMonth ?? "never"}.`;
  // Label anchors: middle of each shaded region, between the lines.
  const midUnder = Math.max(1, Math.floor(underEnd / 2));
  const underPt = curve[midUnder];
  const underY = underPt ? (y(underPt.resale) + y(underPt.balance)) / 2 : 80;
  const midYours = evenMonth !== null ? Math.floor((evenMonth + 60) / 2) : 30;
  const yoursPt = curve[midYours];
  const yoursY = yoursPt ? (y(yoursPt.resale) + y(yoursPt.balance)) / 2 : 100;
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
          <line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="#E7E5DF" strokeWidth={1} />
          <text x={left - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="#5A5C60" fontFamily="'IBM Plex Mono', monospace">
            {v / 1000}k
          </text>
        </g>
      ))}
      {xTicks.map((m) => (
        <text key={m} x={x(m)} y={192} textAnchor="middle" fontSize={10} fill="#5A5C60" fontFamily="'IBM Plex Mono', monospace">
          {m}
        </text>
      ))}
      {under ? <path d={under} fill={WARM_FILL} fillOpacity={0.75} /> : null}
      {yours ? <path d={yours} fill={GREEN_FILL} fillOpacity={0.8} /> : null}
      <polyline
        points={pointsAttr(curve, "balance", x, y)}
        fill="none"
        stroke={INK}
        strokeWidth={2}
        strokeDasharray="5 4"
      />
      <polyline
        points={pointsAttr(curve, "resale", x, y)}
        fill="none"
        stroke={GOLD}
        strokeWidth={2.5}
      />
      {underEnd > 2 ? (
        <text x={x(midUnder)} y={Math.min(bottom - 6, underY + 22)} textAnchor="middle" fontSize={11} fontWeight={600} fill={WARM_TEXT} fontFamily="'IBM Plex Sans', sans-serif">
          underwater
        </text>
      ) : null}
      {evenMonth !== null ? (
        <text x={x(midYours)} y={Math.max(top + 10, yoursY - 10)} textAnchor="middle" fontSize={11} fontWeight={600} fill={GREEN_TEXT} fontFamily="'IBM Plex Sans', sans-serif">
          yours if you sell
        </text>
      ) : null}
      {cross ? (
        <>
          <circle cx={x(cross.month)} cy={y(cross.resale)} r={5} fill="#FFFFFF" stroke={INK} strokeWidth={2} />
          <text x={Math.min(right - 52, x(cross.month) + 8)} y={Math.max(top + 10, y(cross.resale) - 9)} fontSize={11} fontWeight={600} fill={INK} fontFamily="'IBM Plex Sans', sans-serif">
            {`month ${cross.month}: even`}
          </text>
        </>
      ) : null}
      <line x1={selX} x2={selX} y1={top} y2={bottom} stroke={INK} strokeWidth={1.5} />
      <circle cx={selX} cy={y(sel.resale)} r={4.5} fill={GOLD} />
      <circle cx={selX} cy={y(sel.balance)} r={4.5} fill={INK} />
      <text
        x={Math.min(right - 30, Math.max(left + 30, selX + (selX > 240 ? -34 : 10)))}
        y={(y(sel.resale) + y(sel.balance)) / 2 + 4}
        fontSize={11}
        fontWeight={600}
        fill={backColor}
        fontFamily="'IBM Plex Mono', monospace"
      >
        {backLabel}
      </text>
    </svg>
  );
}
