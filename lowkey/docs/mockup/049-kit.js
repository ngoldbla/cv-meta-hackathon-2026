/* 049 mockup kit: shared pieces. Every figure is read from window.LK (049-data.js). */
(function () {
  const D = window.LK;
  const $ = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + $(Math.abs(n));
  const mi = (m) => `${Math.round(m)} mi`;

  const ICON = {
    key: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="8" cy="14" r="4.5" stroke="var(--brass)" stroke-width="2"/><path d="M11.2 10.8 20 2M16 6l3 3M13.5 8.5l2.5 2.5" stroke="var(--brass)" stroke-width="2" stroke-linecap="round"/></svg>',
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    chevD: '<svg class="chev" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevR: '<svg class="chev" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-6-5.5-6-11a6 6 0 1112 0c0 5.5-6 11-6 11z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.2" stroke="currentColor" stroke-width="1.8"/></svg>',
    file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    camera: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="1.8"/></svg>',
    sliders: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="7" r="2" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="17" r="2" stroke="currentColor" stroke-width="1.8"/></svg>',
  };

  function split(car) {
    const i = car.label.indexOf(car.model);
    return { name: car.label.slice(0, i + car.model.length), trim: car.label.slice(i + car.model.length).trim() };
  }
  const car = (model) => D.cars.find((c) => c.model === model);
  const byReal = () => [...D.cars].sort((a, b) => a.cost.realTotal - b.cost.realTotal);
  const maxPay = () => Math.max(...D.cars.map((c) => c.cost.payTotal));
  const years = (c) => (c.life ? Math.round(c.life.years) : null);
  const stockLine = (c) => `${$(c.face.price)} · lowest of ${c.listingTotal} listed`;

  const COLORS = { loan: "var(--cost-loan)", gas: "var(--cost-gas)", valueLost: "var(--cost-lost)", interest: "var(--cost-interest)", tax: "var(--cost-tax)" };
  const NAMES = { loan: "Loan", gas: "Gas", valueLost: "Value lost", interest: "Interest", tax: "Sales tax" };

  function bar(segs, scale, extraBack, thin) {
    const pct = (u) => ((u / scale) * 100).toFixed(2) + "%";
    let h = segs.map((s) => `<i style="width:${pct(s.usd)};background:${COLORS[s.part]}"></i>`).join("");
    if (extraBack) h += `<i style="width:${pct(extraBack)};background:var(--cost-back-a);opacity:.75"></i>`;
    return `<div class="bar${thin ? " thin" : ""}">${h}</div>`;
  }

  /** You pay vs really costs, on one scale (the product's signature). */
  function costBars(c, opts = {}) {
    const scale = opts.scale ?? maxPay();
    const k = c.cost;
    const legend = opts.legend
      ? `<div class="legend" style="margin-top:6px">${[...k.pay, ...k.real.filter((s) => s.part !== "gas")]
          .map((s) => `<span><i style="background:${COLORS[s.part]}"></i>${NAMES[s.part]} ${$(s.usd)}</span>`)
          .join("")}</div>`
      : "";
    return `<div class="bars">
      ${bar(k.pay, scale, 0, opts.thin)}<div class="v num">You pay <b>${$(k.payTotal)}</b></div>
      ${bar(k.real, scale, k.backWhenSold, opts.thin)}<div class="v num">Costs <b>${$(k.realTotal)}</b></div>
    </div>${legend}`;
  }

  function cardFace(c, opts = {}) {
    const { name, trim } = split(c);
    const tags = c.labels.map((l) => `<span class="tag${l === "Cheapest to own" ? " brass" : ""}">${l}</span>`).join("");
    return `<div class="carline"><span class="name">${name} <span class="trim">${trim}</span></span><span class="price num">${$(c.cost.realTotal)}<small>/mo</small></span></div>
      ${tags ? `<div class="labels">${tags}</div>` : '<div style="height:8px"></div>'}
      ${costBars(c, { thin: true, scale: opts.scale })}
      <div class="small muted" style="margin-top:8px">${mi(c.face.miles)} away · lasts about ${years(c)} yrs · positive equity by month ${c.pe}</div>
      <div class="small muted">${stockLine(c)}</div>`;
  }

  function walkChart(c, sel) {
    const W = 358, H = 170, L = 34, R = 8, T = 10, B = 22;
    const pts = c.curve;
    const top = Math.ceil(Math.max(...pts.map((p) => Math.max(p.r, p.b))) / 5000) * 5000;
    const x = (m) => L + (m / 60) * (W - L - R);
    const y = (v) => T + (1 - v / top) * (H - T - B);
    const line = (key) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.m).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
    const pe = c.pe;
    const area = (from, to) => {
      const seg = pts.filter((p) => p.m >= from && p.m <= to);
      return "M" + seg.map((p) => `${x(p.m).toFixed(1)},${y(p.r).toFixed(1)}`).join("L") + "L" + seg.reverse().map((p) => `${x(p.m).toFixed(1)},${y(p.b).toFixed(1)}`).join("L") + "Z";
    };
    const grid = [0, top / 2, top].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--border)" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted-foreground)">${v / 1000}k</text>`).join("");
    const ticks = [0, 12, 24, 36, 48, 60].map((m) => `<text x="${x(m)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted-foreground)">${m}</text>`).join("");
    const s = pts.find((p) => p.m === sel);
    return `<div class="walk-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Worth if sold and what you owe over 60 months">${grid}${ticks}
      <path d="${area(0, pe)}" fill="var(--chart-under)" opacity=".9"/><path d="${area(pe, 60)}" fill="var(--chart-yours)" opacity=".9"/>
      <path d="${line("r")}" fill="none" stroke="var(--brass)" stroke-width="2"/>
      <path d="${line("b")}" fill="none" stroke="var(--foreground)" stroke-width="1.6" stroke-dasharray="4 3"/>
      <line x1="${x(sel)}" x2="${x(sel)}" y1="${T}" y2="${H - B}" stroke="var(--foreground)" stroke-width="1"/>
      <circle cx="${x(sel)}" cy="${y(s.r)}" r="4" fill="var(--brass)"/><circle cx="${x(sel)}" cy="${y(s.b)}" r="4" fill="var(--foreground)"/>
      <text x="${x(pe) + 4}" y="${y(pts[pe].r) - 8}" font-size="10.5" font-weight="600" fill="var(--foreground)">month ${pe}: even</text>
    </svg></div>
    <div class="legend" style="margin:4px 0 0"><span><i style="background:var(--brass)"></i>Worth if sold</span><span><i style="background:var(--foreground)"></i>You owe</span></div>`;
  }

  function slider(sel) {
    const pct = (sel / 60) * 100;
    return `<div class="slider" aria-label="Month you sell"><div class="track"></div><div class="fill" style="width:calc(${pct}% - 12px)"></div><div class="knob" style="left:calc(${pct}% - 12px)"></div></div>`;
  }

  function walkSay(c, sel) {
    const w = c.walk.find((r) => r.m === sel);
    const back = w.back >= 0
      ? `you walk away with <b class="pos">${$(w.back)}</b> after the loan is paid off.`
      : `you would owe <b class="neg">${$(-w.back)}</b> to sell.`;
    return `<div class="walk-say"><div class="xs" style="opacity:.75;margin-bottom:2px">Sell at month ${sel}</div>If you sell then, ${back} Having the car cost you <b>${$(w.per)} a month</b>, interest included.</div>`;
  }

  function walkTable(c, sel) {
    return `<table class="walk"><thead><tr><th>Sell at</th><th>You get back</th><th>Cost per month</th></tr></thead><tbody>${c.walk
      .map((w) => `<tr${w.m === sel ? ' class="sel"' : ""}><td>${w.m} months</td><td class="num">${signed(w.back)}</td><td class="num">${$(w.per)}</td></tr>`)
      .join("")}</tbody></table>`;
  }

  function units(c) {
    return [c.face, ...c.more]
      .map((u) => `<div class="unit"><div class="d"><div>${u.title}</div><div class="small muted">${u.dealer} · ${mi(u.miles)}</div></div><div class="p num">${$(u.price)}</div>${ICON.chevR}</div>`)
      .join("");
  }

  function dealSheet(c) {
    const loan = c.price + c.tax - c.down;
    return `<div class="kv"><span class="k">Listed price</span><span class="num">${$(c.price)}</span></div>
      <div class="kv"><span class="k">Sales tax (est.)</span><span class="num">${$(c.tax)}</span></div>
      <div class="kv"><span class="k">Down (10%)</span><span class="num">−${$(c.down)}</span></div>
      <div class="kv"><span class="k">Loan</span><span class="num">${$(loan)}</span></div>
      <div class="kv total"><span>Monthly at ${c.apr}% for ${c.term} mo</span><span class="num">${$(c.monthly)}</span></div>
      <div class="kv"><span class="k">Positive equity by</span><span>month ${c.pe}</span></div>`;
  }

  const settingsText = () => `10% down · 60 mo · ${D.cars[0].apr}% APR`;

  function settingsLine() {
    return `<div style="display:flex;align-items:center;gap:8px;min-height:44px"><span class="small">${ICON.sliders}</span><span class="small num">${settingsText()} · est. tax incl.</span><span style="flex:1"></span><span class="small link">Change</span></div>`;
  }

  function settingsPanel() {
    return `<div class="label">Down payment</div>
      <div style="display:flex;gap:8px"><div class="seg" style="width:104px"><div>$</div><div class="on">%</div></div><div class="field focus" style="flex:1">10<span class="unit">% of the price</span></div></div>
      <div class="label">Loan term</div>
      <div class="seg"><div>36</div><div>48</div><div class="on">60</div><div>72</div></div>
      <div class="label">APR</div>
      <div class="field">${D.cars[0].apr}<span class="unit">%</span></div>
      <div class="xs muted" style="margin-top:6px">${D.aprLabel}. Type your own rate if you have one.</div>
      <div class="small" style="margin-top:12px"><span class="link">Back to the defaults</span></div>`;
  }

  function quoteStart(forCar) {
    const c = car(forCar);
    const { name } = split(c);
    return `<div class="small muted" style="margin-bottom:10px">Compared with the <b style="color:var(--foreground)">${name}</b> on the same terms.</div>
      <div class="drop"><div style="font-weight:600;margin-bottom:4px">A dealer's sheet or window sticker</div><div class="small muted" style="margin-bottom:12px">A photo from your library, a screenshot, or a PDF from email.</div>
      <div style="display:flex;gap:8px"><span class="btn primary" style="flex:1">${ICON.file}Choose a photo or PDF</span><span class="btn" style="flex:1">${ICON.camera}Take a photo</span></div></div>
      <div class="small muted" style="margin-top:10px">Or <span class="link">type the numbers in</span>. Nothing is stored.</div>`;
  }

  function quoteResult(forCar) {
    const Q = D.quote, c = car(forCar);
    const { name } = split(c);
    const fee = (k) => Q.fees.filter((f) => f.kind === k);
    const rows = Q.headsUp.rows;
    const fmt = (r, v) => (v === null ? "—" : r.label.startsWith("Positive") ? `month ${v}` : $(v));
    const dfmt = (r) => (r.difference === null ? "—" : r.label.startsWith("Positive") ? `${r.difference > 0 ? "+" : ""}${r.difference} mo` : signed(r.difference));
    return `<div class="surface pad">
        <div style="font-weight:600">${Q.vehicle}</div><div class="xs muted" style="margin-bottom:8px">Read from your photo · sample quote, invented</div>
        <div class="kv"><span class="k">Selling price</span><span class="num">${$(Q.sellingPrice)}</span></div>
        ${fee("dealer").concat(fee("government")).map((f) => `<div class="kv"><span class="k">${f.label}</span><span class="num">${$(f.amount)}</span></div>`).join("")}
        <div class="kv"><span class="k">Add-ons: ${fee("addon").map((f) => f.label.toLowerCase()).join(", ")}</span><span class="num diff-up">${$(Q.addons)}</span></div>
        <div class="kv total"><span>Out the door</span><span class="num">${$(Q.otd)}</span></div>
        <div class="small muted" style="margin-top:6px">As quoted: ${$(Q.down)} down, ${Q.apr}% for ${Q.term} months is <b style="color:var(--foreground)">${$(Q.asQuoted.monthly)} a month</b>.</div>
      </div>
      <div class="ask" style="margin-top:10px">${Q.questions[0]}</div>
      <h3 style="margin:18px 0 6px">Next to the ${name}</h3>
      <div class="xs muted" style="margin-bottom:6px">Both on 10% down, ${c.apr}% for ${c.term} months; the quote's sales tax is estimated (${$(Q.headsUp.addedTax)}).</div>
      <table class="hu"><thead><tr><th></th><th>Quote</th><th>${c.model.replace(" Sedan", "")}</th><th>Difference</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${r.label}</td><td class="num">${fmt(r, r.quote)}</td><td class="num">${fmt(r, r.pick)}</td><td class="num ${r.difference > 0 ? "diff-up" : ""}">${dfmt(r)}</td></tr>`).join("")}
      </tbody></table>`;
  }

  const header = (opts = {}) =>
    `<div class="hdr"><span class="wordmark">${ICON.key}<span>lowkey<span class="tld">.autos</span></span></span><span class="sp"></span>${opts.about === false ? "" : '<span class="nav muted">About</span>'}<span class="nav strong">Check a quote</span></div>`;
  const appbar = (title, right = "") => `<div class="appbar"><span class="back">${ICON.back}</span><span class="t">${title}</span><span class="sp"></span>${right}</div>`;

  function tiles(on) {
    const kinds = [["sedan", "Sedan"], ["suv", "SUV"], ["pickup", "Pickup"], ["minivan", "Minivan"], ["hybrid", "Hybrid"]];
    return `<div class="tiles">${kinds.map(([k, l]) => `<div class="tile${on === l ? " on" : ""}"><span class="car">${window.LK_CARS[k]}</span>${l}</div>`).join("")}</div>`;
  }

  function areaLine() {
    return `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;min-height:44px" class="small">${ICON.pin}<span>Near <b>${D.place} ${D.zip}</b> <span class="muted">(approximate)</span></span><span class="link">Change</span><span class="link">Use my location</span></div>`;
  }

  /** Render the same screens twice: light and dark. */
  function board(screens) {
    const row = (dark) =>
      `<div class="frames">${screens
        .map((s) => `<div class="frame"><div class="frame-cap">${s.cap} <span>${s.sub ?? ""}</span></div><div class="phone${dark ? " dark" : ""}">${s.html()}</div></div>`)
        .join("")}</div>`;
    document.getElementById("light").innerHTML = row(false);
    document.getElementById("dark").innerHTML = row(true);
  }

  window.K = { D, $, signed, mi, ICON, split, car, byReal, maxPay, years, stockLine, costBars, cardFace, walkChart, slider, walkSay, walkTable, units, dealSheet, settingsLine, settingsPanel, settingsText, quoteStart, quoteResult, header, appbar, tiles, areaLine, board };
})();
