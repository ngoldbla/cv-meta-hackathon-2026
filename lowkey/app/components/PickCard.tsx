import { cardSentence, underwaterLabel } from "@/lib/summary";
import { MiniChart, type CurveLike } from "./WorthChart";

interface PickLike {
  rank: number | null;
  make: string;
  model: string;
  price: number;
  retention5y: number;
  depPerMonth: number;
  flag?: "badge" | "extra";
}

interface OwnershipLike {
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

export interface LocalLike {
  bestPrice?: number;
  bestDealer?: string;
  units: { dealer: string; distanceMiles: number; price: number; url: string }[];
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function fmt(n: number | undefined): string {
  return n === undefined ? "—" : usd.format(n);
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
  const bestUnit = local?.units.reduce(
    (a, b) => (b.price < a.price ? b : a),
    local.units[0],
  );
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
  return (
    <article className="pick-card">
      <div className="pick-head">
        <span className="pick-rank">{label}</span>
        <span className="sample-tag">SAMPLE DATA</span>
      </div>
      <h3 className="pick-title">
        {pick.make} {pick.model}
      </h3>
      <p className="pick-why">{sentence}</p>
      <dl className="pick-grid">
        <div>
          <dt>Per month</dt>
          <dd className="mono">{ownership ? `${fmt(ownership.monthlyPayment)}/mo` : "—"}</dd>
        </div>
        <div>
          <dt>Keeps after 5 years</dt>
          <dd className="mono">{`${Math.round(pick.retention5y * 100)}% · ${fmt(pick.price * pick.retention5y)}`}</dd>
        </div>
        <div>
          <dt>Leave at 1 year</dt>
          <dd className="mono">{leave1y ? fmt(leave1y.walkAwayCost) : "—"}</dd>
        </div>
        <div>
          <dt>Best local price</dt>
          <dd className="mono">{fmt(local?.bestPrice ?? bestUnit?.price)}</dd>
        </div>
        <div className="pick-chart-cell">
          <dt>{ownership ? underwaterLabel(even) : "Worth vs owe"}</dt>
          <dd>
            {ownership?.curve ? (
              <MiniChart curve={ownership.curve} evenMonth={even} />
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Nearest sample dealer</dt>
          <dd>
            {bestUnit ? (
              <>
                {bestUnit.dealer} ·{" "}
                <span className="mono">{bestUnit.distanceMiles} mi</span>
                {" · "}
                <a href={bestUnit.url} target="_blank" rel="noreferrer">
                  See the car
                </a>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
      {ownership && onWalkAway ? (
        <button type="button" className="walk-link" onClick={onWalkAway}>
          If I change my mind
        </button>
      ) : null}
      {ownership ? (
        <details className="walk-table">
          <summary>Walk-away table</summary>
          <table>
            <thead>
              <tr>
                <th>Sell at</th>
                <th>You get back</th>
                <th>Cost per month</th>
              </tr>
            </thead>
            <tbody>
              {ownership.walkAway.map((p) => (
                <tr key={p.month}>
                  <td className="mono">{p.month} mo</td>
                  <td className="mono">{p.getBack !== undefined ? signed(p.getBack) : "—"}</td>
                  <td className="mono">
                    {fmt(p.costPerMonth ?? p.perMonth)}/mo
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
      <style>{`
        .pick-card { background: var(--card); border: 1px solid var(--line);
          border-radius: 12px; padding: 16px; margin: 12px 0; }
        .pick-head { display: flex; justify-content: space-between;
          align-items: center; gap: 8px; }
        .pick-rank { color: var(--brass); font-weight: 700; font-size: 13px;
          letter-spacing: 0.04em; text-transform: uppercase; }
        .pick-title { margin: 8px 0 6px; font-size: 19px; }
        .pick-why { margin: 0 0 12px; font-size: 14px; line-height: 1.5; color: #3E4044; }
        .pick-grid { display: grid; grid-template-columns: 1fr 1fr;
          gap: 12px 16px; margin: 0; }
        .pick-grid dt { color: var(--muted); font-size: 12px; margin-bottom: 2px; }
        .pick-grid dd { margin: 0; font-size: 15px; }
        .pick-chart-cell dd { max-width: 220px; }
        .walk-link { margin-top: 12px; font: inherit; font-size: 14px; font-weight: 600;
          color: var(--brass); background: none; border: 0; padding: 6px 0; cursor: pointer;
          text-decoration: underline; text-underline-offset: 3px; }
        .walk-table { margin-top: 12px; border-top: 1px solid var(--line);
          padding-top: 10px; font-size: 14px; }
        .walk-table summary { cursor: pointer; font-weight: 600; }
        .walk-table table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        .walk-table th, .walk-table td { text-align: left; padding: 6px 4px;
          border-bottom: 1px solid var(--line); font-size: 13px; }
        .walk-table th { color: var(--muted); font-weight: 500; }
        @media (max-width: 420px) { .pick-grid { grid-template-columns: 1fr; } }
      `}</style>
    </article>
  );
}
