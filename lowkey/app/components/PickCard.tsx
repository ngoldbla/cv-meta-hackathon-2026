import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import {
  effectiveMonthlyCost,
  lastsAboutLabel,
  monthlyBills,
  trimLineText,
} from "@/lib/costs";
import { cardSentence, underwaterLabel } from "@/lib/summary";
import { CarFigure } from "./hairline/CarFigure";
import type { CarKind } from "@/lib/hairline/cars";
import { MiniChart, type CurveLike } from "./WorthChart";

const KIND_BY_CATEGORY: Record<string, CarKind> = {
  Sedan: "sedan",
  SUV: "suv",
  Pickup: "pickup",
};

interface PickLike {
  rank: number | null;
  make: string;
  model: string;
  price: number;
  typicalNewPrice?: number;
  retention5y: number;
  retentionRetail?: number;
  depPerMonth: number;
  flag?: "badge" | "extra";
  baseTrim?: string | null;
  stepUpTrim?: string | null;
  recommendedTrim?: string | null;
  trimStepCost?: number | null;
  trimIsStepUp?: boolean;
  trimGuardHit?: boolean;
  trimRetention5y?: number | null;
  trimFeatures?: string[];
  tradeInFactor?: number;
  lifespanYears?: number | null;
  lifespanSource?: string | null;
  lifespanAsOf?: string | null;
}

interface OwnershipLike {
  price?: number;
  priceSource?: "local" | "typical" | "given";
  priceLabel?: string | null;
  monthlyPayment: number;
  loanAmount?: number;
  downPayment?: number;
  aprPercent?: number;
  evenMonth?: number | null;
  underwaterMonth?: number | null;
  curve?: CurveLike[];
  walkAway: {
    month: number;
    getBack?: number;
    costPerMonth?: number;
    walkAwayCost: number;
    perMonth: number;
  }[];
}

export interface FuelLike {
  text: string;
  perMonth: number;
  low: number;
  high: number;
  seriesDisplay: string;
  latestDate: string;
}

export interface LocalLike {
  zip?: string;
  bestPrice?: number | null;
  bestDealer?: string | null;
  unitsFound?: number;
  totalFound?: number;
  radiusUsed?: number;
  widened?: boolean;
  error?: string | null;
  fuel?: FuelLike | null;
  recommendedTrim?: string | null;
  baseTrim?: string | null;
  trimUsed?: string | null;
  fellBackToBase?: boolean;
  units: {
    dealer: string;
    distanceMiles: number;
    daysOnLot?: number | null;
    year?: number | null;
    trim?: string | null;
    price: number;
    url: string;
  }[];
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function fmt(n: number | undefined | null): string {
  return n === undefined || n === null ? "—" : usd.format(n);
}

export default function PickCard({
  pick,
  ownership,
  local,
  peers,
  category,
  onWalkAway,
}: {
  pick: PickLike;
  ownership?: OwnershipLike;
  local?: LocalLike;
  peers?: PickLike[];
  category?: string;
  onWalkAway?: () => void;
}) {
  const units = local?.units ?? [];
  const bestUnit =
    units.length > 0
      ? units.reduce((a, b) => (b.price < a.price ? b : a))
      : undefined;
  const cheapest = pick.flag === "badge" || pick.flag === "extra";
  const label =
    pick.flag === "badge"
      ? "Cheapest to own"
      : pick.flag === "extra"
        ? "Extra pick · cheapest to own"
        : pick.rank
          ? `Pick #${pick.rank}`
          : "Pick";
  const even = ownership
    ? (ownership.evenMonth !== undefined ? ownership.evenMonth : ownership.underwaterMonth ?? null)
    : null;
  const sentence = cardSentence(
    pick,
    ownership,
    peers && peers.length > 0 ? peers : [pick],
    category ?? "",
  );
  const bills = ownership
    ? monthlyBills(ownership.monthlyPayment, local?.fuel?.perMonth)
    : null;
  const priceForCost = ownership?.price ?? pick.price;
  const loanForCost =
    ownership?.loanAmount ??
    (ownership?.downPayment !== undefined
      ? priceForCost - ownership.downPayment
      : priceForCost * 0.9);
  const effective =
    ownership !== undefined
      ? effectiveMonthlyCost({
          price: priceForCost,
          retentionAfterDiscount: pick.retention5y,
          monthlyPayment: ownership.monthlyPayment,
          loanAmount: loanForCost,
          fuelPerMonth: local?.fuel?.perMonth,
        })
      : null;
  const trimLine = trimLineText({
    baseTrim: pick.baseTrim,
    stepUpTrim: pick.stepUpTrim,
    recommendedTrim: pick.recommendedTrim,
    trimIsStepUp: pick.trimIsStepUp,
    trimGuardHit: pick.trimGuardHit,
    trimRetention5y: pick.trimRetention5y,
    modelRetentionRetail:
      pick.retentionRetail ?? pick.retention5y / 0.85,
    tradeInFactor: pick.tradeInFactor,
    trimStepCost: pick.trimStepCost,
    trimFeatures: pick.trimFeatures,
    aprPercent: ownership?.aprPercent,
    fellBackToBase: local?.fellBackToBase,
  });
  return (
    <Card className="my-3">
      <CardHeader>
        <div>
          <Badge color={cheapest ? "amber" : "gray"} shimmer={false}>
            {label}
          </Badge>
        </div>
        <CardTitle className="text-[19px]">
          {pick.make} {pick.model}
        </CardTitle>
        <CardDescription>{sentence}</CardDescription>
        {units.length > 0 ? (
          <CardAction>
            <StatusDot tone="success" showLabel label="In stock" size="sm" />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {category && KIND_BY_CATEGORY[category] ? (
          <div className="mx-auto w-[176px] max-w-full">
            <CarFigure kind={KIND_BY_CATEGORY[category]} />
          </div>
        ) : null}
        {trimLine ? (
          <p className="mb-3 text-[13px] leading-relaxed text-foreground/80">{trimLine}</p>
        ) : null}
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3">
          <div>
            <dt className="text-xs text-muted-foreground">Monthly bills</dt>
            <dd className="mono text-[15px]">
              {bills
                ? bills.gas !== null
                  ? `${fmt(bills.total)} a month: ${fmt(bills.loan)} loan + ${fmt(bills.gas)} gas`
                  : `${fmt(bills.total)} a month (loan; no gas estimate)`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Cost to drive</dt>
            <dd className="mono text-[15px]">
              {effective !== null ? `${fmt(effective)} a month` : "—"}
            </dd>
            <dd className="text-[13px] leading-relaxed text-foreground/80">
              Lower than your bills, because you keep the car&apos;s resale value.
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Distance to the dealer</dt>
            <dd className="text-[15px]">
              {local?.error ? (
                <span>{local.error}</span>
              ) : bestUnit ? (
                <span>
                  <span className="mono">{bestUnit.distanceMiles} mi</span>
                  {" · "}
                  {bestUnit.dealer}
                  {" · "}
                  <a
                    href={bestUnit.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block py-[13px] -my-[13px]"
                  >
                    See the car
                  </a>
                </span>
              ) : local ? (
                <span>No local stock found. Payment uses the typical price.</span>
              ) : (
                "—"
              )}
            </dd>
          </div>
          {pick.lifespanYears !== null && pick.lifespanYears !== undefined ? (
            <div>
              <dt className="text-xs text-muted-foreground">Lifespan</dt>
              <dd className="text-[15px]">{lastsAboutLabel(pick.lifespanYears)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-muted-foreground">
              {ownership ? underwaterLabel(even) : "Worth vs owe"}
            </dt>
            <dd className="max-w-[220px]">
              {ownership?.curve ? (
                <MiniChart curve={ownership.curve} evenMonth={even} />
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
        {pick.lifespanYears !== null && pick.lifespanYears !== undefined &&
        pick.lifespanSource ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Lifespan: {pick.lifespanSource}
            {pick.lifespanAsOf ? `, as of ${pick.lifespanAsOf}` : ""}.
          </p>
        ) : null}
        {ownership && onWalkAway ? (
          <button
            type="button"
            className="mt-1 min-h-11 py-1.5 text-left text-sm font-semibold text-brass underline underline-offset-[3px]"
            onClick={onWalkAway}
          >
            If I change my mind
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}
