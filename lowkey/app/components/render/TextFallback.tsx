"use client";

import { Button } from "@/components/ui/b-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { effectiveMonthlyCost, lifespanRowText, monthlyBills } from "@/lib/costs";
import type { SpecEntry } from "@/lib/render/specs";
import { cardSentence, positiveEquityLabel } from "@/lib/summary";
import { fmtUsd } from "./format";

/**
 * Text fallback (task 034, part 5): when a spec fails the number
 * guard it is dropped and the card falls back to plain text built
 * from the same tool outputs. No bars, no charts.
 */
export function TextFallback({
  entry,
  peers,
  category,
  onWalkAway,
}: {
  entry: SpecEntry;
  peers: SpecEntry["pick"][];
  category: string;
  onWalkAway?: () => void;
}) {
  const { pick, ownership, local } = entry;
  const sentence = cardSentence(pick, undefined, peers.length > 0 ? peers : [pick], category);
  const bills = ownership
    ? monthlyBills(ownership.monthlyPayment, local?.fuel?.perMonth)
    : null;
  const effective =
    ownership !== undefined && ownership
      ? effectiveMonthlyCost({
          price: ownership.price,
          retentionAfterDiscount: pick.retention5y,
          monthlyPayment: ownership.monthlyPayment,
          loanAmount: ownership.loanAmount,
          fuelPerMonth: local?.fuel?.perMonth,
          taxAmount: ownership.taxAmount ?? 0,
        })
      : null;
  const even = ownership
    ? ownership.evenMonth !== undefined
      ? ownership.evenMonth
      : (ownership.underwaterMonth ?? null)
    : null;
  return (
    <Card className="my-3">
      <CardHeader>
        <CardTitle className="text-[19px]">
          {pick.make} {pick.model}
        </CardTitle>
        <CardDescription>{sentence}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 text-[15px]">
          <p>
            Monthly bills:{" "}
            {bills
              ? bills.gas !== null
                ? `${fmtUsd(bills.total)} a month: ${fmtUsd(bills.loan)} loan + ${fmtUsd(bills.gas)} gas`
                : `${fmtUsd(bills.total)} a month (loan; no gas estimate)`
              : "—"}
          </p>
          <p>Cost to drive: {effective !== null ? `${fmtUsd(effective)} a month` : "—"}</p>
          <p>Lifespan: {lifespanRowText(pick.lifespanYears)}</p>
          <p>{ownership ? positiveEquityLabel(even) : "Equity: —"}</p>
        </div>
        {ownership && onWalkAway ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11 w-full"
            onClick={onWalkAway}
          >
            If I change my mind
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
