"use client";

import { priceSentence, type Position } from "@/lib/priceStats";

import { fmtUsd } from "./format";

export interface PriceStripProps {
  modelKey: string;
  title: string;
  year: number | null;
  unitYear: number | null;
  sameYear: boolean;
  radius: number;
  localLoaded: boolean;
  nationalLoaded: boolean;
  localCount: number | null;
  low: number | null;
  p25: number | null;
  localMedian: number | null;
  p75: number | null;
  high: number | null;
  nationalMedian: number | null;
  nationalCount: number | null;
  msrp: number | null;
  msrpOwn: boolean;
  listed: number | null;
  vsLocalMedian: number | null;
  vsNationalMedian: number | null;
  vsMsrp: number | null;
  positionSide: "lower" | "higher" | "at" | null;
  positionShare: number | null;
}

/** The legend keys, drawn once so the track and the list match. */
function Key({ kind }: { kind: "unit" | "band" | "range" | "local" | "national" | "msrp" }) {
  const common = "inline-block shrink-0";
  switch (kind) {
    case "unit":
      return <span aria-hidden="true" className={`${common} size-3 rounded-full border-2 border-background bg-brass ring-1 ring-brass`} />;
    case "band":
      return <span aria-hidden="true" className={`${common} h-2 w-4 rounded-[2px] bg-[var(--strip-band)]`} />;
    case "range":
      return <span aria-hidden="true" className={`${common} h-[2px] w-4 bg-[var(--strip-range)]`} />;
    case "local":
      return <span aria-hidden="true" className={`${common} h-3 w-[2px] bg-foreground`} />;
    case "national":
      return <span aria-hidden="true" className={`${common} h-3 w-0 border-l-2 border-dashed border-muted-foreground`} />;
    case "msrp":
      return <span aria-hidden="true" className={`${common} size-2 rotate-45 border border-foreground bg-background`} />;
  }
}

function Row({ kind, label, value }: { kind: Parameters<typeof Key>[0]["kind"]; label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Key kind={kind} />
        <span>{label}</span>
      </dt>
      <dd className="shrink-0 text-right text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Price in context (task 054, part 2). Every figure is a guarded spec
 * prop; the sentence is written in code from the same props. The track
 * is drawn for sighted readers only: the list under it carries the same
 * figures in words, so nothing relies on position or colour alone.
 */
export function PriceStripView(p: PriceStripProps) {
  const points = [p.low, p.high, p.localMedian, p.nationalMedian, p.msrp, p.listed].filter(
    (n): n is number => n !== null,
  );
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const pad = Math.max((hi - lo) * 0.06, 1);
  const x = (n: number) => `${((n - lo + pad) / (hi - lo + 2 * pad)) * 100}%`;
  const position: Position | null =
    p.positionSide === "at"
      ? { side: "at", share: null }
      : p.positionSide && p.positionShare !== null
        ? ({ side: p.positionSide, share: p.positionShare } as Position)
        : null;
  const sentence = !p.sameYear ? null : priceSentence({
    title: p.title,
    radius: p.radius,
    localLoaded: p.localLoaded,
    localCount: p.localCount,
    facts: { listed: p.listed, vsLocalMedian: p.vsLocalMedian, vsMsrp: p.vsMsrp, msrpOwn: p.msrpOwn, position },
  });
  const drawable = points.length >= 2;

  return (
    <section aria-labelledby={`strip-${p.modelKey}`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id={`strip-${p.modelKey}`} className="text-lg font-semibold">
          Where this price sits
        </h2>
        <p className="text-xs text-muted-foreground">Listed prices for a {p.title}, as advertised.</p>
      </div>

      {drawable ? (
        <div aria-hidden="true" className="relative h-12">
          {p.low !== null && p.high !== null ? (
            <span
              className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-[var(--strip-range)]"
              style={{ left: x(p.low), width: `calc(${x(p.high)} - ${x(p.low)})` }}
            />
          ) : null}
          {p.p25 !== null && p.p75 !== null ? (
            <span
              className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-[3px] bg-[var(--strip-band)]"
              style={{ left: x(p.p25), width: `max(4px, calc(${x(p.p75)} - ${x(p.p25)}))` }}
            />
          ) : null}
          {p.localMedian !== null ? (
            <span className="absolute top-1/2 h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-foreground" style={{ left: x(p.localMedian) }} />
          ) : null}
          {p.nationalMedian !== null ? (
            <span
              className="absolute top-1/2 h-8 w-0 -translate-x-1/2 -translate-y-1/2 border-l-2 border-dashed border-muted-foreground"
              style={{ left: x(p.nationalMedian) }}
            />
          ) : null}
          {p.msrp !== null ? (
            <span
              className="absolute top-1 size-2.5 -translate-x-1/2 rotate-45 border border-foreground bg-background"
              style={{ left: x(p.msrp) }}
            />
          ) : null}
          {p.listed !== null ? (
            <span
              className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-brass ring-1 ring-brass"
              style={{ left: x(p.listed) }}
            />
          ) : null}
        </div>
      ) : null}

      <dl className="flex flex-col divide-y divide-border">
        {p.listed !== null ? <Row kind="unit" label="This car" value={fmtUsd(p.listed)} /> : null}
        {p.localMedian !== null ? (
          <Row kind="local" label={`Local median, ${(p.localCount ?? 0).toLocaleString("en-US")} within ${p.radius} mi`} value={fmtUsd(p.localMedian)} />
        ) : null}
        {p.p25 !== null && p.p75 !== null ? (
          <Row kind="band" label="Middle half nearby" value={`${fmtUsd(p.p25)}–${fmtUsd(p.p75)}`} />
        ) : null}
        {p.low !== null && p.high !== null ? (
          <Row kind="range" label="9 in 10 nearby" value={`${fmtUsd(p.low)}–${fmtUsd(p.high)}`} />
        ) : null}
        {p.nationalMedian !== null ? (
          <Row kind="national" label={`National median, ${(p.nationalCount ?? 0).toLocaleString("en-US")} listed`} value={fmtUsd(p.nationalMedian)} />
        ) : null}
        {p.msrp !== null ? (
          <Row kind="msrp" label={p.msrpOwn ? "MSRP for this car" : "Median MSRP for this trim"} value={fmtUsd(p.msrp)} />
        ) : null}
      </dl>

      {sentence ? <p className="max-w-[70ch] text-sm leading-relaxed">{sentence}</p> : null}
      {!p.sameYear ? (
        <p className="text-sm leading-relaxed">
          {p.unitYear !== null
            ? `This one is a ${p.unitYear}. The figures above are for ${p.year} models, so it isn't placed among them.`
            : "This listing doesn't give its model year, so it isn't placed among them."}
        </p>
      ) : null}
      {!p.nationalLoaded ? (
        <p className="text-xs text-muted-foreground">National prices couldn&apos;t be loaded just now.</p>
      ) : p.nationalMedian === null ? (
        <p className="text-xs text-muted-foreground">Too few listed nationally for a national median.</p>
      ) : null}
    </section>
  );
}
