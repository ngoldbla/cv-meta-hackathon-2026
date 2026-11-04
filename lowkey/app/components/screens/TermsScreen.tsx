"use client";

import { useState } from "react";

import { Button } from "@/components/ui/b-button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/b-togglegroup";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import { TERM_CHOICES, type Terms } from "@/lib/routes";

import { AppBar } from "./Chrome";

type DownMode = "pct" | "usd";

function parseNum(s: string): number | null {
  const t = s.replace(/[$,%\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Your terms (task 049): the down payment ($ or %), the term and the APR
 * as real controls. Done re-prices every car in code (the search re-runs
 * with these settings) and keeps them in the link.
 */
export function TermsScreen({
  terms,
  aprPercent,
  aprLabel,
  fallback,
  onDone,
}: {
  terms: Terms;
  /** The rate the cards are priced at now (the Federal Reserve default unless the shopper set one). */
  aprPercent: number | null;
  aprLabel: string | null;
  fallback: string;
  onDone: (next: Terms) => void;
}) {
  const [mode, setMode] = useState<DownMode>(terms.down !== null ? "usd" : "pct");
  const [down, setDown] = useState(
    terms.down !== null ? String(terms.down) : String(terms.downPct ?? 10),
  );
  const [term, setTerm] = useState(String(terms.term ?? 60));
  const [apr, setApr] = useState(terms.apr !== null ? String(terms.apr) : "");

  const downN = parseNum(down);
  const aprN = parseNum(apr);
  const downError =
    downN === null || Number.isNaN(downN)
      ? "Enter a down payment."
      : mode === "pct" && (downN < 0 || downN > 100)
        ? "A percent from 0 to 100."
        : mode === "usd" && (downN < 0 || downN > 500_000)
          ? "A dollar amount from $0 to $500,000."
          : null;
  const aprError = aprN !== null && (Number.isNaN(aprN) || aprN < 0 || aprN > 30) ? "A rate from 0% to 30%." : null;

  function done() {
    if (downError || aprError || downN === null) return;
    onDone({
      down: mode === "usd" ? downN : null,
      downPct: mode === "pct" ? downN : null,
      apr: aprN,
      term: Number(term),
    });
  }

  return (
    <div>
      <main className="shell">
        <AppBar title="Your terms" fallback={fallback} />
        <form
          className="flex flex-col gap-5 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            done();
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Down payment</legend>
            <div className="flex gap-2">
              <ToggleGroup
                aria-label="Down payment as"
                variant="outline"
                multiple={false}
                value={[mode]}
                onValueChange={(v) => {
                  const next = v[0] as DownMode | undefined;
                  if (!next || next === mode) return;
                  setMode(next);
                  setDown(next === "pct" ? "10" : "");
                }}
                className="shrink-0"
              >
                <ToggleGroupItem value="usd" aria-label="Dollars" className="min-h-11 min-w-11">
                  $
                </ToggleGroupItem>
                <ToggleGroupItem value="pct" aria-label="Percent of the price" className="min-h-11 min-w-11">
                  %
                </ToggleGroupItem>
              </ToggleGroup>
              <label className="sr-only" htmlFor="terms-down">
                {mode === "pct" ? "Down payment, percent of the price" : "Down payment, dollars"}
              </label>
              <Input
                id="terms-down"
                inputMode="decimal"
                value={down}
                onChange={(e) => setDown(e.target.value)}
                aria-invalid={Boolean(downError)}
                aria-describedby="terms-down-note"
                className="min-h-11 flex-1"
                placeholder={mode === "pct" ? "10" : "5,000"}
              />
            </div>
            <Typography id="terms-down-note" variant="paragraph-xs" className={downError ? "text-destructive" : "text-muted-foreground"}>
              {downError ?? (mode === "pct" ? "Percent of each car's price with dealer fees." : "The same dollar amount on every car.")}
            </Typography>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Loan term</legend>
            <ToggleGroup
              aria-label="Loan term in months"
              variant="outline"
              multiple={false}
              value={[term]}
              onValueChange={(v) => v[0] && setTerm(v[0])}
              className="grid w-full grid-cols-4"
            >
              {TERM_CHOICES.map((t) => (
                <ToggleGroupItem key={t} value={String(t)} className="min-h-11 w-full">
                  {t} mo
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">APR</legend>
            <label className="sr-only" htmlFor="terms-apr">
              APR, percent
            </label>
            <Input
              id="terms-apr"
              inputMode="decimal"
              value={apr}
              onChange={(e) => setApr(e.target.value)}
              aria-invalid={Boolean(aprError)}
              aria-describedby="terms-apr-note"
              placeholder={aprPercent !== null ? String(aprPercent) : "Your rate"}
              className="min-h-11"
            />
            <Typography id="terms-apr-note" variant="paragraph-xs" className={aprError ? "text-destructive" : "text-muted-foreground"}>
              {aprError ??
                (aprLabel
                  ? `Empty uses ${aprLabel}. Type your own rate if you have one.`
                  : "Empty uses the Federal Reserve's average for new-car loans. Type your own rate if you have one.")}
            </Typography>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="min-h-11" disabled={Boolean(downError || aprError)}>
              Show the cars on these terms
            </Button>
            <Button
              type="button"
              variant="link"
              linkUnderline="static"
              className="min-h-11 underline underline-offset-2"
              onClick={() => onDone({ down: null, downPct: null, apr: null, term: null })}
            >
              Back to the defaults
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
