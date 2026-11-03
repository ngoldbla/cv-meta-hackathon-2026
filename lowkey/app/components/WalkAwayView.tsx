"use client";

import { useState } from "react";

import { FullChart, type CurveLike } from "./WorthChart";

export interface WalkAwayOwnership {
  price: number;
  downPayment: number;
  aprPercent: number;
  termMonths: number;
  monthlyPayment: number;
  curve: CurveLike[];
  monthly: {
    month: number;
    getBack: number;
    costPerMonth: number;
  }[];
  walkAway: {
    month: number;
    getBack: number;
    costPerMonth: number;
  }[];
  evenMonth: number | null;
}

export interface WalkAwayPick {
  rank: number | null;
  make: string;
  model: string;
}

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function money(n: number): string {
  return usd0.format(Math.round(n));
}

function signedMoney(n: number): string {
  if (n < 0) return `-$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
  return money(n);
}

function whenLabel(month: number): string {
  if (month === 6) return "6 mo";
  if (month === 12) return "1 yr";
  if (month === 24) return "2 yrs";
  if (month === 36) return "3 yrs";
  if (month === 60) return "5 yrs";
  return `${month} mo`;
}

export default function WalkAwayView({
  pick,
  ownership,
  aprText,
  onBack,
}: {
  pick: WalkAwayPick;
  ownership: WalkAwayOwnership;
  aprText: string;
  onBack: () => void;
}) {
  const [month, setMonth] = useState(36);
  const detail =
    ownership.monthly.find((p) => p.month === month) ??
    ownership.monthly[ownership.monthly.length - 1];
  const getBack = detail?.getBack ?? 0;
  const costPerMonth = detail?.costPerMonth ?? 0;
  const even = ownership.evenMonth;
  const headline =
    even === null
      ? "Underwater for the whole term."
      : even <= 0
        ? "Never underwater. It's yours from day one."
        : even === 1
          ? "Underwater for 1 month. Then it's yours."
          : `Underwater for ${even} months. Then it's yours.`;
  const downPct = Math.round((ownership.downPayment / ownership.price) * 100);
  const rankLabel = pick.rank ? `#${pick.rank} · ` : "";
  return (
    <section aria-label="If I change my mind" className="walk-view">
      <div className="walk-head">
        <button type="button" className="walk-back" onClick={onBack} aria-label="Back to your picks">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1C1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <span className="walk-title">
          {rankLabel}
          {pick.make} {pick.model}
        </span>
      </div>
      <h2 className="walk-h">{headline}</h2>
      <p className="walk-intro">
        The gold line is what the car would sell for. The dashed line is what you still owe. Once gold is on top, selling pays off the loan and the difference comes back to you.
      </p>
      <section aria-label="Worth if sold versus what you owe" className="walk-chart-card">
        <div className="walk-legend">
          <span className="legend-item">
            <span className="legend-gold" />
            Worth if sold
          </span>
          <span className="legend-item">
            <span className="legend-dash" />
            You owe
          </span>
        </div>
        <FullChart
          curve={ownership.curve}
          evenMonth={even}
          selectedMonth={month}
          selectedGetBack={getBack}
        />
        <div className="walk-slider">
          <input
            type="range"
            min={1}
            max={60}
            step={1}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            aria-label="Month you sell"
          />
          <span className="walk-slider-label">Drag to pick when you sell</span>
        </div>
        <div className="walk-dark">
          <span className="walk-dark-kicker">Sell at month {month}</span>
          <span className="walk-dark-line">
            {getBack >= 0 ? (
              <>
                You walk away with <strong className="mono walk-green">{money(getBack)}</strong> after the loan is paid off.
              </>
            ) : (
              <>
                You would still owe <strong className="mono walk-warm">{money(-getBack)}</strong> to sell.
              </>
            )}
          </span>
          <span className="walk-dark-line">
            Having the car cost you <strong className="mono walk-gold">{money(costPerMonth)} a month</strong>, interest included.
          </span>
        </div>
      </section>
      <section aria-label="If you sell at" className="walk-table-section">
        <div className="walk-table-head mono-head">
          <span>Sell at</span>
          <span className="num">You get back</span>
          <span className="num">Cost per month</span>
        </div>
        {ownership.walkAway.map((p) => (
          <div key={p.month} className="walk-table-row">
            <span className="walk-when">{whenLabel(p.month)}</span>
            <span className="mono num">{signedMoney(p.getBack)}</span>
            <span className="mono num">{money(p.costPerMonth)}</span>
          </div>
        ))}
        <p className="walk-note">
          Cost per month falls the longer you keep it. A minus sign means you would owe the difference to sell.
        </p>
      </section>
      <p className="walk-foot">
        {money(ownership.price)}, {downPct}% down, {ownership.termMonths} months, {aprText}. Say “my rate is 5.9%” to change it. Worth if sold = recent sales of this model, less 15%. Excludes tax, insurance, fuel and repairs.
      </p>
      <style>{`
        .walk-view { display: flex; flex-direction: column; gap: 18px; padding: 6px 0 10px; }
        .walk-head { display: flex; align-items: center; gap: 8px; }
        .walk-back { width: 44px; height: 44px; display: flex; align-items: center;
          justify-content: center; background: none; border: 0; cursor: pointer; padding: 0; }
        .walk-title { font-size: 15px; font-weight: 500; }
        .walk-view .sample-tag { align-self: flex-start; }
        .walk-h { margin: 0; font-size: 30px; line-height: 1.15; font-weight: 600;
          letter-spacing: -0.02em; text-wrap: balance; }
        .walk-intro { margin: 0; font-size: 15px; line-height: 1.55; color: #3E4044; }
        .walk-chart-card { background: var(--card); border: 1px solid var(--line);
          border-radius: 14px; padding: 16px 12px 14px; display: flex;
          flex-direction: column; gap: 10px; }
        .walk-legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px;
          color: #3E4044; padding: 0 4px; }
        .legend-item { display: inline-flex; align-items: center; gap: 6px; }
        .legend-gold { width: 18px; height: 3px; background: #7A5A10; border-radius: 2px; }
        .legend-dash { width: 18px; border-top: 2px dashed #1B1C1E; }
        .walk-slider { padding: 0 4px; display: flex; flex-direction: column; gap: 6px; }
        .walk-slider input[type="range"] { width: 100%; min-height: 32px; accent-color: #1B1C1E; }
        .walk-slider-label { font-size: 11px; color: var(--muted); text-align: center; }
        .walk-dark { background: #1B1C1E; color: #F3F2EE; border-radius: 10px;
          padding: 14px; display: flex; flex-direction: column; gap: 4px; }
        .walk-dark-kicker { font-size: 12px; color: #C9C6BC; text-transform: uppercase;
          letter-spacing: 0.06em; }
        .walk-dark-line { font-size: 16px; line-height: 1.45; }
        .walk-green { color: #A9D3B3; }
        .walk-gold { color: #E2C77E; }
        .walk-warm { color: #E9B8A4; }
        .walk-table-section { display: flex; flex-direction: column; gap: 10px; }
        .walk-table-head { display: grid; grid-template-columns: 64px minmax(0, 1fr) minmax(0, 1fr);
          gap: 10px; font-size: 11px; color: var(--muted); text-transform: uppercase;
          letter-spacing: 0.05em; }
        .walk-table-row { display: grid; grid-template-columns: 64px minmax(0, 1fr) minmax(0, 1fr);
          gap: 10px; align-items: baseline; border-top: 1px solid var(--line); padding-top: 8px; }
        .walk-table-row .num, .walk-table-head .num { text-align: right; }
        .walk-table-row .mono { font-size: 14px; }
        .walk-when { font-size: 14px; font-weight: 500; }
        .walk-note { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
        .walk-foot { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.5; }
      `}</style>
    </section>
  );
}
