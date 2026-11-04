"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ListingSheet } from "@/components/ListingSheet";
import { fmtUsd } from "@/components/render/format";
import { Button } from "@/components/ui/b-button";
import { Input } from "@/components/ui/input";
import { DealActions } from "@/components/quote/DealActions";
import { SavedDeals } from "@/components/quote/SavedDeals";
import { useDeals } from "@/components/quote/useDeals";
import { VinStep } from "@/components/quote/VinStep";
import { Typography } from "@/components/ui/typography";
import { downFor, type DealInputs, type DownRule } from "@/lib/deal";
import { loadDeals, saveDeal, type SavedDeal } from "@/lib/deals";
import { decodeVin } from "@/lib/quote/barcode";
import { estTaxFor, resaleFor, type CarInfo, type VinRetention } from "@/lib/quote/benchmark";
import { fileToJpegBase64, UnreadableFileError } from "@/lib/quote/image";
import { analyzeQuote, headsUp, type PickDeal, type SameTerms } from "@/lib/quote/compare";
import {
  emptyQuote,
  FEE_KINDS,
  quoteFromRead,
  readSchema,
  vinCheckOk,
  type FeeKind,
  type MoneyField,
  type Quote,
} from "@/lib/quote/schema";
import { decodeDeal } from "@/lib/quote/shareLink";
import type { VinFacts } from "@/lib/vin";

/**
 * Got the VIN? (tasks 046, 047 and 059). The VIN comes first (scanned, from a photo, or typed) and fills in the car; then the shopper types a dealer quote,
 * or photographs a buyer's order or window sticker and confirms what
 * the reader found. Code then shows the out-the-door price, the
 * add-ons on their own line, whether the stated payment matches the
 * quote's own numbers, and the quote next to other dealers or a Low
 * Key pick on the same terms. No winner is named; differences are in
 * plain dollars.
 */

export interface QuotePick {
  key: string;
  label: string;
  deal: PickDeal;
  retention5y: number | null;
  /** The pick's tax rule and MPG, to estimate tax on a quote that lists none. */
  dealInputs: DealInputs | null;
}

const MAX_QUOTES = 3;
const DRAFT_KEY = "lowkey-quote-draft-v1";
const POLL_MS = 1000;
const READ_LIMIT_MS = 240_000; // a hosted read, then the backup GPU's cold start

const hasContent = (x: Quote) =>
  Boolean(x.vin) || x.sellingPrice !== null || x.outTheDoor !== null || x.statedMonthly !== null || x.apr !== null;

type ReadState = "idle" | "reading" | "failed" | "resting" | "off" | "unsupported";

const FIELD_LABELS: Record<MoneyField, string> = {
  sellingPrice: "Vehicle price",
  msrp: "MSRP (sticker)",
  rebates: "Rebates",
  tradeIn: "Trade-in",
  down: "Down payment",
  outTheDoor: "Out-the-door total",
  statedMonthly: "Their monthly payment",
  apr: "APR (%)",
  termMonths: "Term (months)",
  amountFinanced: "Amount financed",
};
const FIELD_ORDER: MoneyField[] = [
  "sellingPrice",
  "rebates",
  "down",
  "tradeIn",
  "apr",
  "termMonths",
  "statedMonthly",
  "outTheDoor",
  "amountFinanced",
  "msrp",
];
const KIND_LABEL: Record<FeeKind, string> = {
  government: "Tax, title or registration",
  dealer: "Dealer fee",
  addon: "Add-on (optional)",
  unknown: "Not sure",
};

function signed(n: number, unit = ""): string {
  if (Math.round(n) === 0) return "same";
  return `${n > 0 ? "+" : "−"}${fmtUsd(Math.abs(n))}${unit}`;
}

function quoteName(q: Quote, i: number): string {
  return q.dealerName?.trim() || `Quote ${i + 1}`;
}

function loadDraft(): Quote[] | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Quote[];
    return Array.isArray(parsed) && parsed.length ? parsed.slice(0, MAX_QUOTES) : null;
  } catch {
    return null;
  }
}

function saveDraft(quotes: Quote[]) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(quotes));
  } catch {
    /* storage can be unavailable; the draft is a convenience only */
  }
}

export function QuoteCheck({
  wide,
  onClose,
  picks,
  aprPercent,
  aprText,
  downRule = { kind: "share", share: 0.1 },
  termMonths = 60,
  initialPickKey,
  inline = false,
  openDealId = null,
}: {
  /** Task 059: a saved deal to open (from the Your deal row). */
  openDealId?: string | null;
  /** Task 049: on its own screen (/quote) rather than in a drawer. */
  inline?: boolean;
  wide: boolean;
  onClose: () => void;
  picks: QuotePick[];
  aprPercent: number;
  aprText: string;
  downRule?: DownRule;
  termMonths?: number;
  initialPickKey?: string | null;
}) {
  const [quotes, setQuotes] = useState<Quote[]>(() => [emptyQuote()]);
  const [active, setActive] = useState(0);
  const [readState, setReadState] = useState<ReadState>("idle");
  const [pickKey, setPickKey] = useState<string | null>(initialPickKey ?? picks[0]?.key ?? null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [dragging, setDragging] = useState(false);
  const cancelled = useRef(false);
  // Task 057: each quote's VIN lookup (the car and its model's resale history), by quote index.
  const [carInfo, setCarInfo] = useState<Record<number, { facts: VinFacts; retention: VinRetention | null } | "none">>({});
  // The VIN the photo read found, when it differs from the barcode's ("The sheet says …").
  const [sheetVin, setSheetVin] = useState<Record<number, string>>({});
  const lastFile = useRef<File | null>(null);
  // Task 059: the VIN comes first; "pending" until the browser's draft, link or saved deal has been read.
  const [step, setStep] = useState<"pending" | "vin" | "deal">("pending");
  const [shared, setShared] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [listingPrice, setListingPrice] = useState<Record<number, number>>({});
  const [canScan, setCanScan] = useState(false);
  const [activeDeal, setActiveDeal] = useState<string | null>(null);
  const { deals } = useDeals();

  const openSaved = (d: SavedDeal) => {
    setQuotes([d.quote]);
    setActive(0);
    setActiveDeal(d.id);
    setShared(false);
    setStep("deal");
    const c = d.quote.car;
    setCarInfo(
      c
        ? {
            0: {
              facts: { vin: d.quote.vin ?? "", status: c.status, year: c.year, make: c.make, model: c.model, trim: c.trim, msrp: null, listedPrice: null, miles: c.miles, dealerName: null },
              retention: d.retention,
            },
          }
        : {},
    );
  };

  const lookupCar = useCallback(async (index: number, vin: string) => {
    try {
      const res = await fetch(`/api/vin?vin=${encodeURIComponent(vin)}`);
      const body = (await res.json()) as { ok: boolean; facts?: VinFacts; retention?: VinRetention | null };
      if (!body.ok || !body.facts) {
        setCarInfo((c) => ({ ...c, [index]: "none" }));
        return;
      }
      const f = body.facts;
      setCarInfo((c) => ({ ...c, [index]: { facts: f, retention: body.retention ?? null } }));
      if (f.listedPrice !== null) setListingPrice((p) => ({ ...p, [index]: f.listedPrice as number }));
      setQuotes((all) =>
        all.map((x, i) =>
          i === index
            ? {
                ...x,
                vin: f.vin,
                year: x.year ?? f.year,
                sellingPrice: x.sellingPrice ?? f.listedPrice,
                dealerName: x.dealerName ?? f.dealerName,
                vehicle: x.vehicle ?? ([f.make, f.model, f.trim].filter(Boolean).join(" ") || null),
                mileage: x.mileage ?? f.miles,
                car: { year: f.year, make: f.make, model: f.model, trim: f.trim, miles: f.miles, status: f.status },
              }
            : x,
        ),
      );
    } catch {
      setCarInfo((c) => ({ ...c, [index]: "none" }));
    }
  }, []);

  // Start the reader loading while the shopper finds a photo.
  useEffect(() => {
    cancelled.current = false;
    void fetch("/api/quote/warm", { method: "POST" })
      .then((r) => {
        if (r.status === 503) setReadState((s) => (s === "idle" ? "off" : s));
      })
      .catch(() => {});
    setCanScan(Boolean(navigator.mediaDevices?.getUserMedia));
    const hash = window.location.hash;
    const fromLink = decodeDeal(hash);
    const saved = openDealId ? loadDeals().find((d) => d.id === openDealId) : undefined;
    if (fromLink) {
      setQuotes([fromLink]);
      setShared(true);
      setStep("deal");
      if (fromLink.vin) void lookupCar(0, fromLink.vin);
    } else if (saved) {
      openSaved(saved);
    } else {
      if (hash.startsWith("#d=")) setLinkError(true);
      const draft = loadDraft();
      if (draft) setQuotes(draft);
      setStep(draft && draft.some(hasContent) ? "deal" : "vin");
    }
    return () => {
      cancelled.current = true;
    };
  }, []);

  useEffect(() => {
    if (!shared && step !== "pending") saveDraft(quotes);
  }, [quotes, shared, step]);

  const terms: SameTerms = useMemo(
    () => ({ downRule, aprPercent, termMonths }),
    [downRule, aprPercent, termMonths],
  );
  const q = quotes[active] ?? quotes[0];
  const pick = picks.find((p) => p.key === pickKey) ?? null;
  const infoOf = (i: number): CarInfo | null => {
    const c = carInfo[i];
    return c && c !== "none" ? { year: c.facts.year, miles: c.facts.miles, retention: c.retention } : null;
  };
  const own = (x: Quote, i: number) => resaleFor(x, infoOf(i), picks, new Date().getFullYear());

  const update = useCallback(
    (patch: Partial<Quote>, touched: string[] = []) => {
      setQuotes((all) =>
        all.map((x, i) =>
          i === active
            ? { ...x, ...patch, unconfirmed: x.unconfirmed.filter((f) => !touched.includes(f)) }
            : x,
        ),
      );
    },
    [active],
  );

  const onPhoto = async (file: File | undefined, mode: "terms" | "full" = "terms") => {
    if (!file) return;
    lastFile.current = file;
    const index = active;
    let barcodeVin: string | null = null;
    // Track 1: a VIN barcode, decoded on the device, starts the VIN lookup at once.
    if (mode === "terms" && file.type !== "application/pdf") {
      void decodeVin(file).then((vin) => {
        if (vin && !cancelled.current) {
          barcodeVin = vin;
          void lookupCar(index, vin);
          setStep("deal");
        }
      });
    }
    setReadState("reading");
    setElapsed(0);
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    try {
      let image_b64: string;
      try {
        image_b64 = await fileToJpegBase64(file);
      } catch (e) {
        return setReadState(e instanceof UnreadableFileError ? "unsupported" : "failed");
      }
      const start = await fetch("/api/quote/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image_b64, mime: "image/jpeg", mode }),
      });
      if (start.status === 429) return setReadState("resting");
      if (start.status === 503) return setReadState("off");
      if (!start.ok) return setReadState("failed");
      const { id } = (await start.json()) as { id?: string };
      if (!id) return setReadState("failed");
      const t0 = Date.now();
      while (!cancelled.current && Date.now() - t0 < READ_LIMIT_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const res = await fetch(`/api/quote/result/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (res.status === 202) continue;
        const body = (await res.json()) as { status?: string; read?: unknown };
        const parsed = readSchema.safeParse(body.read);
        if (body.status !== "done" || !parsed.success) return setReadState("failed");
        const read = quoteFromRead(parsed.data);
        const sheet = read.vin;
        setQuotes((all) =>
          all.map((x, i) =>
            i === index
              ? {
                  ...read,
                  dealerName: x.dealerName,
                  // The VIN lookup may have landed first: keep the car it filled in.
                  car: x.car,
                  year: read.year ?? x.year,
                  vehicle: read.vehicle ?? x.vehicle,
                  mileage: read.mileage ?? x.mileage,
                  sellingPrice: read.sellingPrice ?? x.sellingPrice,
                  vin: barcodeVin ?? sheet ?? x.vin,
                }
              : x,
          ),
        );
        if (sheet) setSheetVin((s) => ({ ...s, [index]: sheet }));
        // No barcode: the VIN the read found (its check digit already holds) starts the lookup now.
        if (!barcodeVin && sheet) void lookupCar(index, sheet);
        setStep("deal");
        return setReadState("idle");
      }
      setReadState("failed");
    } catch {
      setReadState("failed");
    } finally {
      clearInterval(tick);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  const readMessage =
    readState === "reading"
      ? `Reading… ${elapsed} s. This usually takes a few seconds. You can keep typing meanwhile.`
      : readState === "failed"
        ? "Couldn't read that one. You can type it in."
        : readState === "unsupported"
          ? "That file couldn't be opened here. Try a screenshot of it, a JPEG, or a PDF."
          : readState === "resting"
            ? "Photo reading is resting for now. You can type it in."
            : readState === "off"
              ? "Photo reading isn't available right now. You can type it in."
              : "A photo from your library, a screenshot, or a PDF from email all work; for a PDF, the first page is read. Nothing is stored. A draft stays on this device.";

  const analysis = analyzeQuote(q, terms, own(q, active));
  const compareRows =
    quotes.length > 1
      ? quotes.map((x, i) => ({ name: quoteName(x, i), r: analyzeQuote(x, terms, own(x, i)) }))
      : [];
  const estTax = estTaxFor(q, pick);
  const hu = pick ? headsUp(q, pick.deal, downRule, own(q, active), estTax) : null;

  const unconfirmed = new Set(q.unconfirmed);
  const fieldClass = (f: string) =>
    unconfirmed.has(f) ? "min-h-11 ring-2 ring-amber-400/70" : "min-h-11";

  const numberField = (f: MoneyField) => (
    <label key={f} className="flex flex-col gap-1">
      <Typography variant="paragraph-xs" className="text-muted-foreground">
        {f === "sellingPrice" && q.priceIsSticker ? "Sticker price (MSRP)" : FIELD_LABELS[f]}
        {f === "sellingPrice" && q.sellingPrice !== null && q.sellingPrice === listingPrice[active]
          ? " · from the listing; change it if they quoted different"
          : ""}
        {unconfirmed.has(f) ? " · read from your photo, please check" : ""}
      </Typography>
      <Input
        type="text"
        inputMode="decimal"
        value={q[f] === null ? "" : String(q[f])}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9.]/g, "");
          update({ [f]: t === "" ? null : Number(t) } as Partial<Quote>, [f]);
        }}
        className={fieldClass(f)}
      />
    </label>
  );

  return (
    <ListingSheet
      title="Got the VIN?"
      subtitle="Start with the VIN. It fills in the car; then add the deal you were offered."
      wide={wide}
      onClose={onClose}
      inline={inline}
    >
      <div className="flex flex-col gap-5 pb-6">
        {/* Camera: a new photo. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-label="Take a photo of a sheet or sticker"
          onChange={(e) => void onPhoto(e.target.files?.[0])}
        />
        {/* Library, Files, or a PDF saved from email: no capture attribute, so phones offer every source. */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif,application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a photo, screenshot or PDF"
          onChange={(e) => void onPhoto(e.target.files?.[0])}
        />
        {step === "pending" ? <div className="min-h-40" aria-busy="true" /> : null}
        {linkError && step === "vin" ? (
          <Typography variant="paragraph-sm" className="rounded-lg bg-muted px-3 py-2" role="status">
            This link didn&apos;t open; ask for a new one.
          </Typography>
        ) : null}
        {step === "vin" ? (
          <>
            <VinStep
              vin={q.vin ?? ""}
              onTypeVin={(v) => update({ vin: v || null }, ["vin"])}
              onVin={(v) => {
                update({ vin: v }, ["vin"]);
                void lookupCar(active, v);
                setStep("deal");
              }}
              onChooseFile={() => fileRef.current?.click()}
              onTakePhoto={() => cameraRef.current?.click()}
              onSkip={() => setStep("deal")}
              busy={readState === "reading" || readState === "off"}
              message={readMessage}
              canScan={canScan}
            />
            <SavedDeals deals={deals} activeId={activeDeal} onOpen={openSaved} />
          </>
        ) : null}
        {step === "deal" ? (
          <>
            {shared ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <Typography variant="paragraph-sm">
                  Someone shared this deal with you. It&apos;s your own copy to look at or change.
                </Typography>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="min-h-11"
                    onClick={() => {
                      if (saveDeal(q, infoOf(0)?.retention ?? null).ok) setShared(false);
                    }}
                  >
                    Save as my deal
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setQuotes([emptyQuote()]);
                      setActive(0);
                      setCarInfo({});
                      setShared(false);
                      setStep("vin");
                      window.history.replaceState(null, "", window.location.pathname + window.location.search);
                    }}
                  >
                    Check my own
                  </Button>
                </div>
              </div>
            ) : null}
            {quotes.length > 1 || quotes[0].sellingPrice !== null || quotes[0].outTheDoor !== null ? (
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Quotes">
                {quotes.map((x, i) => (
                  <Button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === active}
                    variant={i === active ? "secondary" : "ghost"}
                    className="min-h-11"
                    onClick={() => setActive(i)}
                  >
                    {quoteName(x, i)}
                  </Button>
                ))}
                {quotes.length < MAX_QUOTES ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setQuotes((all) => [...all, emptyQuote()]);
                      setActive(quotes.length);
                    }}
                  >
                    Compare with another dealer
                  </Button>
                ) : null}
              </div>
            ) : null}

            <section
              className={`flex flex-col gap-2 rounded-lg ${dragging ? "outline-2 outline-dashed outline-foreground/40" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (readState !== "reading" && readState !== "off") void onPhoto(e.dataTransfer.files?.[0]);
              }}
            >
              <Typography variant="label-md">Have the offer sheet? Add a photo</Typography>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={readState === "reading" || readState === "off"}
                  onClick={() => fileRef.current?.click()}
                >
                  Choose a photo or PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={readState === "reading" || readState === "off"}
                  onClick={() => cameraRef.current?.click()}
                >
                  Take a photo
                </Button>
              </div>
              <Typography variant="paragraph-xs" className="text-muted-foreground" aria-live="polite">
                {readMessage}
              </Typography>
              {q.readMode === "terms" && lastFile.current && readState === "idle" ? (
                <Button
                  type="button"
                  variant="link"
                  linkUnderline="static"
                  className="min-h-11 self-start underline underline-offset-2"
                  onClick={() => void onPhoto(lastFile.current ?? undefined, "full")}
                >
                  Read everything, fees included
                </Button>
              ) : null}
            </section>

            {q.unconfirmed.length ? (
              <div className="flex flex-col gap-2 rounded-lg border border-amber-400/60 p-3">
                <Typography variant="paragraph-sm">
                  Please check the highlighted fields against your paper. Edit anything that's off.
                </Typography>
                <Button type="button" className="min-h-11" onClick={() => update({}, q.unconfirmed)}>
                  These match my paper
                </Button>
              </div>
            ) : null}

            <section className="grid grid-cols-2 gap-3">
              {q.car ? (
                <div className="col-span-2 flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2">
                  <Typography variant="paragraph-md" className="font-medium">
                    {[q.car.year, q.car.make, q.car.model, q.car.trim].filter(Boolean).join(" ")}
                    {q.mileage !== null ? ` · ${q.mileage.toLocaleString("en-US")} mi` : ""}
                  </Typography>
                  <Typography variant="paragraph-xs" className="text-muted-foreground">
                    {q.car.status === "active" ? "From the car's VIN." : "From the car's VIN. This listing is no longer live."}
                  </Typography>
                </div>
              ) : carInfo[active] === "none" && q.vin ? (
                <Typography variant="paragraph-xs" className="col-span-2 text-muted-foreground">
                  We couldn&apos;t look up this VIN. Type the year, make and model below; the numbers still compare.
                </Typography>
              ) : null}
              <label className="col-span-2 flex flex-col gap-1">
                <Typography variant="paragraph-xs" className="text-muted-foreground">
                  Dealer (optional)
                </Typography>
                <Input
                  type="text"
                  value={q.dealerName ?? ""}
                  onChange={(e) => update({ dealerName: e.target.value || null })}
                  className="min-h-11"
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                <Typography variant="paragraph-xs" className="text-muted-foreground">
                  Car (year, make, model)
                </Typography>
                <Input
                  type="text"
                  value={[q.year ?? "", q.vehicle ?? ""].join(" ").trim()}
                  onChange={(e) => {
                    const m = /^\s*((?:19|20)\d\d)\s*(.*)$/.exec(e.target.value);
                    update(
                      m
                        ? { year: Number(m[1]), vehicle: m[2] || null }
                        : { year: null, vehicle: e.target.value || null },
                    );
                  }}
                  className="min-h-11"
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                <Typography variant="paragraph-xs" className="text-muted-foreground">
                  VIN (optional)
                  {q.vin && q.vin.length === 17 && !vinCheckOk(q.vin) ? " · this VIN doesn't check out; please look again" : ""}
                </Typography>
                <Input
                  type="text"
                  autoCapitalize="characters"
                  maxLength={17}
                  value={q.vin ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase();
                    update({ vin: v || null }, ["vin"]);
                    if (vinCheckOk(v)) void lookupCar(active, v);
                  }}
                  className={fieldClass("vin")}
                />
                {sheetVin[active] && q.vin && sheetVin[active] !== q.vin ? (
                  <Button
                    type="button"
                    variant="link"
                    linkUnderline="static"
                    className="min-h-11 self-start underline underline-offset-2"
                    onClick={() => {
                      const v = sheetVin[active];
                      update({ vin: v }, ["vin"]);
                      void lookupCar(active, v);
                    }}
                  >
                    The sheet says {sheetVin[active]}. Use that instead
                  </Button>
                ) : null}
              </label>
              <label className="col-span-2 flex flex-col gap-1">
                <Typography variant="paragraph-xs" className="text-muted-foreground">
                  Mileage
                  {unconfirmed.has("mileage")
                    ? " · read from your photo, please check"
                    : q.car?.miles != null && q.mileage === q.car.miles
                      ? " · from the listing"
                      : ""}
                </Typography>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={q.mileage === null ? "" : String(q.mileage)}
                  onChange={(e) => {
                    const t = e.target.value.replace(/\D/g, "");
                    update({ mileage: t === "" ? null : Number(t) }, ["mileage"]);
                  }}
                  className={fieldClass("mileage")}
                />
              </label>
              {FIELD_ORDER.map(numberField)}
            </section>

            {q.readMode !== "terms" || q.fees.length > 0 ? (
            <section className="flex flex-col gap-2">
              <Typography variant="label-md">Fees and add-ons</Typography>
              {q.fees.map((f, i) => (
                <div key={i} className="grid grid-cols-[1fr_6.5rem] gap-2">
                  <Input
                    type="text"
                    aria-label="Fee name"
                    value={f.label}
                    onChange={(e) =>
                      update({ fees: q.fees.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }, ["fees"])
                    }
                    className={fieldClass("fees")}
                  />
                  <Input
                    type="text"
                    inputMode="decimal"
                    aria-label="Amount"
                    value={f.amount === null ? "" : String(f.amount)}
                    onChange={(e) => {
                      const t = e.target.value.replace(/[^0-9.]/g, "");
                      update(
                        { fees: q.fees.map((x, j) => (j === i ? { ...x, amount: t === "" ? null : Number(t) } : x)) },
                        ["fees"],
                      );
                    }}
                    className={fieldClass("fees")}
                  />
                  <select
                    aria-label="Kind of charge"
                    value={f.kind}
                    onChange={(e) =>
                      update(
                        { fees: q.fees.map((x, j) => (j === i ? { ...x, kind: e.target.value as FeeKind } : x)) },
                        ["fees"],
                      )
                    }
                    className="min-h-11 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    {FEE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    onClick={() => update({ fees: q.fees.filter((_, j) => j !== i) }, ["fees"])}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 self-start"
                onClick={() => update({ fees: [...q.fees, { label: "", amount: null, kind: "unknown" }] })}
              >
                Add a fee line
              </Button>
            </section>
            ) : null}

            <section className="flex flex-col gap-2 rounded-lg border border-border p-4" aria-live="polite">
              <Typography variant="label-md">What this quote really says</Typography>
              {!analysis.ok ? (
                <Typography variant="paragraph-sm" className="text-muted-foreground">
                  To check this quote, add {analysis.missing.join(" and ")}.
                </Typography>
              ) : (
                <>
                  <Typography variant="paragraph-md">
                    Out the door: {fmtUsd(analysis.analysis.outTheDoor)}
                    <span className="text-muted-foreground">
                      {analysis.analysis.outTheDoorSource === "stated" ? " (as stated)" : " (the sum of the lines)"}
                    </span>
                  </Typography>
                  {analysis.analysis.addonTotal > 0 ? (
                    <Typography variant="paragraph-md">
                      {fmtUsd(analysis.analysis.addonTotal)} of optional add-ons
                    </Typography>
                  ) : null}
                  {analysis.analysis.asQuoted ? (
                    <Typography variant="paragraph-md">
                      Their loan works out to {fmtUsd(analysis.analysis.asQuoted.monthly)}/mo for{" "}
                      {analysis.analysis.asQuoted.termMonths} months, with{" "}
                      {fmtUsd(analysis.analysis.asQuoted.interestPaid)} of interest
                      {analysis.analysis.asQuoted.positiveEquityMonth !== null
                        ? `, and positive equity by month ${analysis.analysis.asQuoted.positiveEquityMonth}`
                        : ""}
                      .
                    </Typography>
                  ) : (
                    <Typography variant="paragraph-sm" className="text-muted-foreground">
                      Add the APR and term to see their loan.
                    </Typography>
                  )}
                  {analysis.analysis.paymentGap !== null ? (
                    <Typography variant="paragraph-md">
                      Their payment is {signed(analysis.analysis.paymentGap, "/mo")} from what their own numbers give.
                    </Typography>
                  ) : null}
                  {analysis.analysis.estimates.length ? (
                    <div className="flex flex-col gap-1">
                      {analysis.analysis.estimates.map((e) => (
                        <Typography key={`${e.down}-${e.termMonths}`} variant="paragraph-md">
                          Their estimate of {fmtUsd(e.low)}–{fmtUsd(e.high)}/mo over {e.termMonths} months on{" "}
                          {fmtUsd(e.financed)} financed
                          {e.aprLow !== null && e.aprHigh !== null
                            ? ` implies an APR of about ${e.aprLow.toFixed(1)}%–${e.aprHigh.toFixed(1)}%.`
                            : "."}
                        </Typography>
                      ))}
                      {q.apr === null ? (
                        <Typography variant="paragraph-xs" className="text-muted-foreground">
                          For comparison, {aprText}. A pre-approval from a bank or credit union gives you a rate to compare.
                        </Typography>
                      ) : null}
                    </div>
                  ) : null}
                  {analysis.analysis.financedGap !== null ? (
                    <Typography variant="paragraph-md">
                      Their amount financed is {signed(analysis.analysis.financedGap)} from what the lines add up to.
                    </Typography>
                  ) : null}
                  {q.priceIsSticker ? (
                    <Typography variant="paragraph-sm" className="text-muted-foreground">
                      This is the window sticker&apos;s total, not a selling price. Dealers can sell above or below it.
                    </Typography>
                  ) : null}
                  {analysis.analysis.feesLump !== null ? (
                    <Typography variant="paragraph-md">
                      Taxes, fees and adjustments: {fmtUsd(analysis.analysis.feesLump)} (the out-the-door total minus the
                      price).
                    </Typography>
                  ) : null}
                  {analysis.analysis.totalGap !== null ? (
                    <Typography variant="paragraph-md">
                      Their total is {signed(analysis.analysis.totalGap)} from the sum of the lines.
                    </Typography>
                  ) : null}
                  {analysis.analysis.questions.length ? (
                    <div className="flex flex-col gap-1 pt-1">
                      <Typography variant="label-sm">Questions to ask</Typography>
                      <ul className="list-disc pl-5">
                        {analysis.analysis.questions.map((x) => (
                          <li key={x}>
                            <Typography variant="paragraph-sm">{x}</Typography>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <Typography variant="paragraph-xs" className="text-muted-foreground">
                    Positive equity uses{" "}
                    {analysis.analysis.resaleBasis === "used-age-miles"
                      ? "this model's sales by age, placed by this car's age and mileage"
                      : analysis.analysis.resaleBasis === "used-age"
                        ? "this model's sales by age (this estimate uses the car's age, not its mileage)"
                        : analysis.analysis.resaleBasis === "used-typical"
                          ? "a typical resale curve, since we have no sales history by age for this model"
                          : analysis.analysis.retentionSource === "model"
                            ? "this model's resale history"
                            : "a typical resale curve"}
                    . Insurance and repairs are extra.
                  </Typography>
                </>
              )}
            </section>

            {compareRows.length > 1 ? (
              <section className="flex flex-col gap-2">
                <Typography variant="label-md">On the same terms</Typography>
                <Typography variant="paragraph-xs" className="text-muted-foreground">
                  {downRule.kind === "share" ? `${Math.round(downRule.share * 100)}% down` : `${fmtUsd(downRule.usd)} down`} ·{" "}
                  {termMonths} months · {aprText}
                </Typography>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 font-normal">Quote</th>
                      <th className="py-1 font-normal">Monthly</th>
                      <th className="py-1 font-normal">Out the door</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map(({ name, r }, i) => {
                      const base = compareRows[0].r;
                      return (
                        <tr key={i} className="border-t border-border">
                          <td className="py-2">{name}</td>
                          <td className="py-2">
                            {r.ok ? fmtUsd(r.analysis.sameTerms.monthly) : "–"}
                            {i > 0 && r.ok && base.ok ? (
                              <span className="block text-xs text-muted-foreground">
                                {signed(r.analysis.sameTerms.monthly - base.analysis.sameTerms.monthly, "/mo")}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2">
                            {r.ok ? fmtUsd(r.analysis.outTheDoor) : "–"}
                            {i > 0 && r.ok && base.ok ? (
                              <span className="block text-xs text-muted-foreground">
                                {signed(r.analysis.outTheDoor - base.analysis.outTheDoor)}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <Typography variant="paragraph-xs" className="text-muted-foreground">
                  Differences are against {compareRows[0].name}.
                </Typography>
              </section>
            ) : null}

            {picks.length ? (
              <section className="flex flex-col gap-2">
                <Typography variant="label-md">Next to a Low Key pick</Typography>
                <div className="flex flex-wrap gap-2">
                  {picks.map((p) => (
                    <Button
                      key={p.key}
                      type="button"
                      variant={p.key === pickKey ? "secondary" : "ghost"}
                      className="min-h-11"
                      onClick={() => setPickKey(p.key)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                {pick && hu ? (
                  hu.ok ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-1 font-normal" />
                          <th className="py-1 font-normal">Your quote</th>
                          <th className="py-1 font-normal">{pick.label}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hu.rows.map((row) => (
                          <tr key={row.label} className="border-t border-border">
                            <td className="py-2 pr-2">{row.label}</td>
                            <td className="py-2">
                              {row.quote === null ? "–" : row.label.startsWith("Positive") ? `month ${row.quote}` : fmtUsd(row.quote)}
                              {row.difference !== null && !row.label.startsWith("Positive") ? (
                                <span className="block text-xs text-muted-foreground">{signed(row.difference)}</span>
                              ) : null}
                            </td>
                            <td className="py-2">
                              {row.pick === null ? "–" : row.label.startsWith("Positive") ? `month ${row.pick}` : fmtUsd(row.pick)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <Typography variant="paragraph-sm" className="text-muted-foreground">
                      Add {hu.missing.join(" and ")} to see it next to {pick.label}.
                    </Typography>
                  )
                ) : null}
                {hu && hu.ok && hu.addedTax !== null ? (
                  <Typography variant="paragraph-xs" className="text-muted-foreground">
                    Your quote lists no sales tax, so its total here includes an estimated {fmtUsd(hu.addedTax)}, the
                    same state estimate the pick uses.
                  </Typography>
                ) : null}
                <Typography variant="paragraph-xs" className="text-muted-foreground">
                  Both on the pick&apos;s terms: {aprText}, {pick?.deal.termMonths ?? termMonths} months,{" "}
                  {pick ? fmtUsd(downFor(downRule, pick.deal.price)) : "10%"} down on the pick.
                </Typography>
              </section>
            ) : (
              <Typography variant="paragraph-xs" className="text-muted-foreground">
                Search for a type of car first to see this quote next to Low Key&apos;s picks.
              </Typography>
            )}

            <Button
              type="button"
              variant="ghost"
              className="min-h-11 self-start"
              onClick={() => {
                setQuotes([emptyQuote()]);
                setActive(0);
                setCarInfo({});
                setListingPrice({});
                setActiveDeal(null);
                setStep("vin");
                setReadState((s) => (s === "off" ? s : "idle"));
              }}
            >
              Start over
            </Button>
            <DealActions
              quote={q}
              retention={infoOf(active)?.retention ?? null}
              canSave={q.sellingPrice !== null || q.outTheDoor !== null}
            />
            <SavedDeals deals={deals} activeId={activeDeal} onOpen={openSaved} />
          </>
        ) : null}
      </div>
    </ListingSheet>
  );
}
