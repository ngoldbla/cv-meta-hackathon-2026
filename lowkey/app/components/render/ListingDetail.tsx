"use client";

import { useContext, useEffect, useId, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/b-button";
import { dealSheetText, type DealSheetFacts } from "@/lib/deal";
import { positiveEquityLabel } from "@/lib/summary";
import { cn } from "@/lib/utils";

import { fmtUsd } from "./format";
import { ListingContext } from "./listing-context";

export interface ListingDetailProps extends DealSheetFacts {
  modelKey: string;
  miles: number;
  daysOnLot: number | null;
  taxNotice: string | null;
  url: string;
}

function Row({
  label,
  value,
  note,
  words = false,
}: {
  label: string;
  value: string;
  note?: string | null;
  /** A sentence rather than a figure: the body face, not the mono one. */
  words?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[2px] border-b border-border py-2.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className={cn("text-right text-[15px] font-semibold", !words && "mono")}>{value}</dd>
      </div>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/**
 * The listing sheet's body (task 041, parts 1 and 2). Every figure is
 * a guarded spec prop. "Take this to the dealer" writes the deal
 * sheet from the same props; "Open dealer's listing" is the last
 * action and opens the dealer's site in a new tab (never a frame).
 */
export function ListingDetailView(props: ListingDetailProps) {
  const { resultsUrl } = useContext(ListingContext);
  const [dealOpen, setDealOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "selected">("idle");
  const [canShare, setCanShare] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const textId = useId();
  const text = dealSheetText(props, resultsUrl ?? "");

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    setCopyState("idle");
  }, [text]);

  function selectText() {
    const el = textRef.current;
    if (!el) return;
    el.focus();
    el.select();
    setCopyState("selected");
  }

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      selectText();
    }
  }

  async function share() {
    try {
      await navigator.share({ title: props.title, text });
    } catch {
      // Cancelled or refused: nothing to do; Copy still works.
    }
  }

  const otd =
    props.outTheDoor !== null
      ? { value: `${fmtUsd(props.outTheDoor)} est.`, note: props.taxNotice }
      : { value: "Tax unknown", note: props.taxNotice ?? "Tax not included: unknown state" };
  const downText =
    props.downShare !== null
      ? `${Math.round(props.downShare * 100)}% down`
      : `${fmtUsd(props.down)} down`;
  const billsNote = `${fmtUsd(props.loan)} loan${props.gas !== null ? ` + ${fmtUsd(props.gas)} gas` : ""}, at ${downText}, ${props.termMonths} months, ${props.aprPercent}% APR`;

  return (
    <section aria-label={`${props.title} at ${props.dealer}`} className="flex flex-col gap-4">
      <dl className="flex flex-col rounded-[14px] border border-border bg-card px-4 py-1">
        <Row label="Price with fees" value={fmtUsd(props.price)} />
        <Row label="Out the door" value={otd.value} note={otd.note} />
        <Row label="You pay each month" value={`${fmtUsd(props.bills)}/mo`} note={billsNote} />
        <Row label="Equity" value={positiveEquityLabel(props.positiveEquityMonth)} words />
        {props.daysOnLot !== null ? (
          <Row
            label="On the lot"
            value={`${props.daysOnLot} ${props.daysOnLot === 1 ? "day" : "days"}`}
          />
        ) : null}
        {props.vin ? <Row label="VIN" value={props.vin} /> : null}
      </dl>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          aria-expanded={dealOpen}
          aria-controls={dealOpen ? textId : undefined}
          onClick={() => setDealOpen((v) => !v)}
          className="min-h-11 w-full"
        >
          Take this to the dealer
        </Button>
        {dealOpen ? (
          <div className="flex flex-col gap-2 rounded-[14px] border border-border bg-card p-3">
            <label htmlFor={textId} className="text-xs text-muted-foreground">
              A short summary to copy or share. No contact details are included.
            </label>
            <textarea
              id={textId}
              ref={textRef}
              readOnly
              value={text}
              rows={Math.min(16, text.split("\n").length + 1)}
              className="mono w-full resize-none rounded-[10px] border border-border bg-background p-2 text-xs leading-relaxed"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void copy()} className="min-h-11 flex-1">
                Copy
              </Button>
              {canShare ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void share()}
                  className="min-h-11 flex-1"
                >
                  Share
                </Button>
              ) : null}
            </div>
            <p role="status" className="text-xs text-muted-foreground">
              {copyState === "copied"
                ? "Copied."
                : copyState === "selected"
                  ? "Selected. Use your device's copy to copy it."
                  : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <a
          href={props.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "min-h-11 w-full justify-center no-underline",
          )}
        >
          Open dealer&apos;s listing
        </a>
        <p className="text-center text-xs text-muted-foreground">
          Opens the dealer&apos;s site in a new tab. Low Key stays open here.
        </p>
      </div>
    </section>
  );
}
