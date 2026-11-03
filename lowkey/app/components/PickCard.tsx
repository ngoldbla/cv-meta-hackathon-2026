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
  underwaterMonth: number | null;
  walkAway: {
    month: number;
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

export default function PickCard({
  pick,
  ownership,
  local,
}: {
  pick: PickLike;
  ownership?: OwnershipLike;
  local?: LocalLike;
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
  return (
    <article className="pick-card">
      <div className="pick-head">
        <span className="pick-rank">{label}</span>
        <span className="sample-tag">SAMPLE DATA</span>
      </div>
      <h3 className="pick-title">
        {pick.make} {pick.model}
      </h3>
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
          <dt>Above water</dt>
          <dd className="mono">
            {ownership?.underwaterMonth ? `month ${ownership.underwaterMonth}` : "—"}
          </dd>
        </div>
        <div>
          <dt>Best local price</dt>
          <dd className="mono">{fmt(local?.bestPrice ?? bestUnit?.price)}</dd>
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
      {ownership ? (
        <details className="walk-table">
          <summary>Walk-away table</summary>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Cost to leave</th>
                <th>Per month of use</th>
              </tr>
            </thead>
            <tbody>
              {ownership.walkAway.map((p) => (
                <tr key={p.month}>
                  <td className="mono">{p.month}</td>
                  <td className="mono">{fmt(p.walkAwayCost)}</td>
                  <td className="mono">{fmt(p.perMonth)}/mo</td>
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
        .pick-title { margin: 8px 0 12px; font-size: 19px; }
        .pick-grid { display: grid; grid-template-columns: 1fr 1fr;
          gap: 12px 16px; margin: 0; }
        .pick-grid dt { color: var(--muted); font-size: 12px; margin-bottom: 2px; }
        .pick-grid dd { margin: 0; font-size: 15px; }
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
