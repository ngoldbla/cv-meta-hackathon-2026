"use client";

import { useState } from "react";

import { Button } from "@/components/ui/b-button";
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

import { aboutUsd, equityHeadline } from "@/lib/summary";

import { FullChart, type CurveLike } from "./WorthChart";

export interface WalkAwayOwnership {
  /** Price with fees, before tax. */
  price: number;
  taxAmount?: number;
  taxNotice?: string | null;
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
  /** First month with positive equity (resale ≥ balance), or null. */
  positiveEquityMonth: number | null;
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
  const positiveMonth = ownership.positiveEquityMonth;
  const headline = equityHeadline(positiveMonth);
  const downPct = Math.round((ownership.downPayment / ownership.price) * 100);
  return (
    <section aria-label="If I change my mind" className="flex flex-col gap-[18px] py-1.5">
      {hideHeader ? null : (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="size-11 shrink-0"
          onClick={onBack}
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Button>
        <span className="text-sm font-medium">
          {pick.make} {pick.model}
        </span>
      </div>
      )}
      <Typography variant="h4" as="h2" className="text-[30px] leading-[1.15] text-balance">
        {headline}
      </Typography>
      <Card>
        <CardContent className="flex flex-col gap-2.5 pt-4">
          <div>
            <FullChart
              curve={ownership.curve}
              positiveEquityMonth={positiveMonth}
              selectedMonth={month}
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
                  About{" "}
                  <strong className="mono text-[#a9d3b3]">
                    $
                    <RollingDigits value={aboutUsd(getBack)} locale="en-US" coalesceUpdates startOnView={false} />
                  </strong>{" "}
                  is yours after you sell and pay off the loan.
                </>
              ) : (
                <>
                  You&apos;d owe about{" "}
                  <strong className="mono text-[#c9c6bc]">
                    $
                    <RollingDigits value={aboutUsd(getBack)} locale="en-US" coalesceUpdates startOnView={false} />
                  </strong>{" "}
                  to sell this early.
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
              <TableHead align="right">Your equity</TableHead>
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
          A minus means you&apos;d still owe something to sell.
        </Typography>
      </section>
      <Typography variant="paragraph-xs" className="text-muted-foreground">
        {money(ownership.price)} with fees
        {ownership.taxAmount
          ? ` + ${money(ownership.taxAmount)} tax in the loan`
          : ""}
        {" "}· {downPct}% down · {ownership.termMonths} mo · {aprText}. Resale: recent sales −15% (tax doesn&apos;t come back).
        {ownership.taxNotice ? ` ${ownership.taxNotice}` : ""} Excl. insurance, fuel, repairs. Say “my rate is 5.9%” to change the rate.
      </Typography>
    </section>
  );
}
