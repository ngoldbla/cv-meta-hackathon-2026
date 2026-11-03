import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RollingDigits } from "@/components/ui/rolling-digits";
import { StatusDot } from "@/components/ui/status-dot";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  depPerMonth: number;
  flag?: "badge" | "extra";
}

interface OwnershipLike {
  price?: number;
  priceSource?: "local" | "typical" | "given";
  priceLabel?: string | null;
  monthlyPayment: number;
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

function signed(n: number): string {
  if (n < 0) return `-$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
  return usd.format(n);
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
  const leave1y = ownership?.walkAway.find((p) => p.month === 12);
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
  const keepsPrice = ownership?.price ?? pick.price;
  const typical = ownership?.priceSource === "typical";
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
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 min-[420px]:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Per month</dt>
            <dd className="mono text-[15px]">
              {ownership ? (
                <>
                  $
                  <RollingDigits
                    value={Math.round(ownership.monthlyPayment)}
                    locale="en-US"
                  />
                  /mo
                  {typical ? (
                    <span className="font-sans text-xs text-muted-foreground"> typical price</span>
                  ) : null}
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Keeps after 5 years</dt>
            <dd className="mono text-[15px]">{`${Math.round(pick.retention5y * 100)}% · ${fmt(keepsPrice * pick.retention5y)}`}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Leave at 1 year</dt>
            <dd className="mono text-[15px]">{leave1y ? fmt(leave1y.walkAwayCost) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Best local price</dt>
            <dd className="mono text-[15px]">{fmt(local?.bestPrice ?? bestUnit?.price)}</dd>
          </div>
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
          <div>
            <dt className="text-xs text-muted-foreground">Local stock</dt>
            <dd className="text-[15px]">
              {local?.error ? (
                <span>{local.error}</span>
              ) : units.length > 0 ? (
                <span>
                  {units.length} nearby · closest{" "}
                  <span className="mono">{bestUnit?.distanceMiles} mi</span>
                </span>
              ) : local ? (
                <span>No local stock found. Payment uses the typical price.</span>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
        {local?.fuel ? (
          <p className="mt-3 text-[13px] leading-relaxed text-foreground/80">{local.fuel.text}</p>
        ) : null}
        {local?.widened ? (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Searched out to 150 miles.
            {local.totalFound !== undefined && local.totalFound < 3
              ? ` Only ${local.totalFound} in stock within 150 miles.`
              : ""}
          </p>
        ) : null}
        {units.length > 0 ? (
          <ul className="mt-2.5 list-disc pl-[18px] text-[13px] leading-relaxed text-foreground/80">
            {units.map((u) => (
              <li key={u.url}>
                <span className="mono">{fmt(u.price)}</span>
                {" · "}
                {u.dealer}
                {" · "}
                <span className="mono">{u.distanceMiles} mi</span>
                {u.daysOnLot !== null && u.daysOnLot !== undefined
                  ? ` · ${u.daysOnLot} days on the lot`
                  : ""}
                {u.year || u.trim
                  ? ` · ${[u.year, u.trim].filter(Boolean).join(" ")}`
                  : ""}
                {" · "}
                <a href={u.url} target="_blank" rel="noreferrer">
                  See the car
                </a>
              </li>
            ))}
          </ul>
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
        {ownership ? (
          <details className="mt-2 border-t border-border pt-2.5 text-sm">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">
              Walk-away table
            </summary>
            <Table columns="minmax(0,0.7fr) minmax(0,1fr) minmax(0,1fr)" size="compact">
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
                    <TableCell className="mono">{p.month} mo</TableCell>
                    <TableCell align="right" className="mono">
                      {p.getBack !== undefined ? signed(p.getBack) : "—"}
                    </TableCell>
                    <TableCell align="right" className="mono">
                      {fmt(p.costPerMonth ?? p.perMonth)}/mo
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
