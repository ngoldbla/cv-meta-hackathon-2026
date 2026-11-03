"use client";

import { BACK_FILL, SEGMENT_COLOR, SEGMENT_LABEL, fmtUsd } from "./format";

export interface CostSegment {
  part: "loan" | "gas" | "valueLost" | "interest";
  usd: number;
}

/**
 * CostBars (task 034): "You pay each month" vs "What it really costs
 * you" on one scale (the bills total). The remainder of the second
 * bar is the hatched "back to you" segment. Static widths: no bar
 * growth animation, so reduced motion needs nothing extra. Task 036:
 * touching segments are separated by a 2 px gap of the card colour
 * (flex gap over a card background); the gaps come out of the track
 * width via flex shrink, and a positive segment keeps at least 2 px.
 */
export function CostBarsView({
  pay,
  real,
  payTotal,
  realTotal,
  backWhenSold,
}: {
  pay: CostSegment[];
  real: CostSegment[];
  payTotal: number;
  realTotal: number;
  backWhenSold: number;
}) {
  const bills = payTotal;
  const scale = bills > 0 ? bills : 1;
  const pct = (n: number) => `${(n / scale) * 100}%`;
  const describe = (segs: CostSegment[]) =>
    segs.map((s) => `${s.usd} ${SEGMENT_LABEL[s.part]?.toLowerCase() ?? s.part}`).join(" and ");
  const aria =
    `Monthly bills ${bills} dollars: ${describe(pay)}. ` +
    `Real cost ${realTotal} dollars: ${describe(real)}. ` +
    `${backWhenSold} dollars a month comes back when you sell.`;
  return (
    <section aria-label={aria} className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-[5px]">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">You pay each month</span>
          <span className="mono text-lg">{fmtUsd(bills)}</span>
        </div>
        <div className="flex h-[22px] gap-[2px] overflow-hidden rounded-[5px] bg-card" aria-hidden="true">
          {pay.map((s) => (
            <span key={s.part} style={{ width: pct(s.usd), minWidth: s.usd > 0 ? 2 : undefined, background: SEGMENT_COLOR[s.part] }} className="block h-full" />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-foreground/80">
          {pay.map((s) => (
            <span key={s.part} className="inline-flex items-center gap-[5px]">
              <span aria-hidden="true" className="inline-block h-[10px] w-[10px] rounded-[2px]" style={{ background: SEGMENT_COLOR[s.part] }} />
              {SEGMENT_LABEL[s.part]} {fmtUsd(s.usd)}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-[5px]">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">What it really costs you</span>
          <span className="mono text-lg">{fmtUsd(realTotal)}</span>
        </div>
        <div className="flex h-[22px] gap-[2px] overflow-hidden rounded-[5px] bg-card" aria-hidden="true">
          {real.map((s) => (
            <span key={s.part} style={{ width: pct(s.usd), minWidth: s.usd > 0 ? 2 : undefined, background: SEGMENT_COLOR[s.part] }} className="block h-full" />
          ))}
          <span style={{ width: pct(backWhenSold), minWidth: backWhenSold > 0 ? 2 : undefined, background: BACK_FILL }} className="block h-full" />
        </div>
        <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-foreground/80">
          {real.map((s) => (
            <span key={s.part} className="inline-flex items-center gap-[5px]">
              <span aria-hidden="true" className="inline-block h-[10px] w-[10px] rounded-[2px]" style={{ background: SEGMENT_COLOR[s.part] }} />
              {SEGMENT_LABEL[s.part]} {fmtUsd(s.usd)}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-[var(--cost-back-bg)] px-2.5 py-2 text-[13px] text-[var(--cost-back-ink)]">
        <span aria-hidden="true" className="inline-block h-[14px] w-[14px] shrink-0 rounded-[2px]" style={{ background: BACK_FILL }} />
        <span>
          <strong className="mono">{fmtUsd(backWhenSold)}</strong> a month of what you pay comes back to you when you sell at 5 years.
        </span>
      </div>
    </section>
  );
}
