"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { RollingDigits } from "@/components/ui/rolling-digits";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Typography } from "@/components/ui/typography";

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
  lifespanYears?: number | null;
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
  hideHeader = false,
}: {
  pick: WalkAwayPick;
  ownership: WalkAwayOwnership;
  aprText: string;
  onBack: () => void;
  /** Hide the back/title row inside the mobile drawer (it has its own). */
  hideHeader?: boolean;
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
    <section aria-label="If I change my mind" className="flex flex-col gap-[18px] py-1.5">
      {hideHeader ? null : (
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex size-11 shrink-0 items-center justify-center"
          onClick={onBack}
          aria-label="Back to your picks"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <span className="text-[15px] font-medium">
          {rankLabel}
          {pick.make} {pick.model}
        </span>
      </div>
      )}
      <Typography variant="h4" as="h2" className="text-[30px] leading-[1.15] text-balance">
        {headline}
      </Typography>
      <Typography variant="paragraph-md" className="text-foreground/80">
        The gold line is what the car would sell for. The dashed line is what you still owe. Once gold is on top, selling pays off the loan and the difference comes back to you.
      </Typography>
      <Card>
        <CardContent className="flex flex-col gap-2.5 pt-4">
          <div className="flex flex-wrap gap-3.5 px-1 text-xs text-foreground/80" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-[3px] w-[18px] rounded-sm bg-brass" />
              Worth if sold
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-[18px] border-t-2 border-dashed border-foreground" />
              You owe
            </span>
          </div>
          <div>
            <FullChart
              curve={ownership.curve}
              evenMonth={even}
              selectedMonth={month}
              selectedGetBack={getBack}
            />
          </div>
          <Slider
            value={month}
            min={1}
            max={60}
            step={1}
            size="lg"
            showValue={false}
            ariaLabel="Month you sell"
            description="Drag to pick when you sell"
            onChange={(v) => setMonth(Array.isArray(v) ? (v[0] ?? 36) : v)}
          />
          <div className="flex flex-col gap-1 rounded-[10px] bg-[#1b1c1e] p-3.5 text-[#f3f2ee]">
            <span className="text-xs tracking-[0.06em] text-[#c9c6bc] uppercase">
              Sell at month {month}
            </span>
            <span className="text-base leading-[1.45]">
              {getBack >= 0 ? (
                <>
                  You walk away with{" "}
                  <strong className="mono text-[#a9d3b3]">
                    $
                    <RollingDigits value={Math.round(getBack)} locale="en-US" coalesceUpdates startOnView={false} />
                  </strong>{" "}
                  after the loan is paid off.
                </>
              ) : (
                <>
                  You would still owe{" "}
                  <strong className="mono text-[#e9b8a4]">
                    $
                    <RollingDigits value={Math.round(-getBack)} locale="en-US" coalesceUpdates startOnView={false} />
                  </strong>{" "}
                  to sell.
                </>
              )}
            </span>
            <span className="text-base leading-[1.45]">
              Having the car cost you{" "}
              <strong className="mono text-[#e2c77e]">
                $
                <RollingDigits value={Math.round(costPerMonth)} locale="en-US" coalesceUpdates startOnView={false} />
                {" "}a month
              </strong>
              , interest included.
            </span>
          </div>
        </CardContent>
      </Card>
      <section aria-label="If you sell at" className="flex flex-col gap-2.5">
        <Table columns="64px minmax(0,1fr) minmax(0,1fr)">
          <TableHeader>
            <TableRow variant="header">
              <TableHead>Sell at</TableHead>
              <TableHead align="right">You get back</TableHead>
              <TableHead align="right">Cost per month</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ownership.walkAway.map((p) => (
              <TableRow key={p.month}>
                <TableCell className="font-medium">{whenLabel(p.month)}</TableCell>
                <TableCell align="right" className="mono">
                  {signedMoney(p.getBack)}
                </TableCell>
                <TableCell align="right" className="mono">
                  {money(p.costPerMonth)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Typography variant="paragraph-sm" className="text-muted-foreground">
          Cost per month falls the longer you keep it. A minus sign means you would owe the difference to sell.
        </Typography>
      </section>
      {pick.lifespanYears ? (
        <Typography variant="paragraph-sm" className="text-muted-foreground">
          Lasts about {Math.round(pick.lifespanYears)} years: {money(ownership.price)} with
          fees is about {money(ownership.price / pick.lifespanYears)} a year of life.
        </Typography>
      ) : null}
      <Typography variant="paragraph-xs" className="text-muted-foreground">
        {money(ownership.price)}, {downPct}% down, {ownership.termMonths} months, {aprText}. Say “my rate is 5.9%” to change it. Worth if sold = recent sales of this model, less 15%. Excludes tax, insurance, fuel and repairs.
      </Typography>
    </section>
  );
}
