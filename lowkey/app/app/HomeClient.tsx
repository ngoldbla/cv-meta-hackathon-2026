"use client";

import { useChat } from "@ai-sdk/react";
import { MotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { CarFigure } from "@/components/hairline/CarFigure";
import PickCard, { type LocalLike } from "@/components/PickCard";
import WalkAwayView from "@/components/WalkAwayView";
import { AIInput } from "@/components/ui/ai-input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/b-togglegroup";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Message,
  MessageBubble,
  MessageContent,
  MessageGroup,
} from "@/components/ui/message";
import {
  ReasoningStep,
  ReasoningSteps,
  ReasoningStepsContent,
  ReasoningStepsTrigger,
} from "@/components/ui/reasoning-steps";
import { RevealText } from "@/components/ui/reveal-text";
import { StreamingText } from "@/components/ui/streaming-text";
import { ThinkingIndicator } from "@/components/ui/thinking-indicator";
import { Typography } from "@/components/ui/typography";
import { areaPlaceLabel, type SearchArea } from "@/lib/geo";
import { closingLine } from "@/lib/summary";
import type { CurveLike } from "@/components/WorthChart";

interface PickOut {
  rank: number | null;
  make: string;
  model: string;
  providerModel?: string;
  price: number;
  typicalNewPrice?: number;
  retention5y: number;
  retentionRetail?: number;
  depPerMonth: number;
  mpg?: number | null;
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

interface RankOutput {
  category: string;
  picks: PickOut[];
  commodity: (PickOut & { flag: "badge" | "extra" }) | null;
  soldVehicles?: number;
  providerAsOf?: string;
  builtAt?: string;
}

interface OwnershipOutput {
  model: string | null;
  price: number;
  priceSource?: "local" | "typical" | "given";
  priceLabel?: string | null;
  typicalPrice?: number | null;
  loanAmount?: number;
  downPayment: number;
  aprPercent: number;
  termMonths: number;
  monthlyPayment: number;
  evenMonth?: number | null;
  underwaterMonth?: number | null;
  curve?: CurveLike[];
  monthly?: { month: number; getBack: number; costPerMonth: number }[];
  walkAway: {
    month: number;
    getBack?: number;
    costPerMonth?: number;
    walkAwayCost: number;
    perMonth: number;
  }[];
  aprLabel?: string | null;
}

interface LocalOutput extends LocalLike {
  model?: string;
  bestPrice?: number;
}

type Part = {
  type: string;
  text?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
};

function toolName(partType: string): string {
  return partType.replace(/^tool-/, "");
}

/** Card key: fixture model, tolerant of a "Make Model" echo. */
function modelKey(model: string, make?: string | null): string {
  const bare = model.trim().toLowerCase();
  if (make) {
    const prefix = `${make.trim().toLowerCase()} `;
    if (bare.startsWith(prefix)) return bare.slice(prefix.length);
  }
  return bare;
}

function KeyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="14" r="4.5" stroke="currentColor" strokeWidth="2" />
      <path d="M11.2 10.8 20 2M16 6l3 3M13.5 8.5l2.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface WalkSelection {
  pick: PickOut;
  ownership: OwnershipOutput;
  aprText: string;
}

const FOOTER_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-11-03" -> "Nov 3, 2026" for the data-dates footer. */
function footerDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${FOOTER_MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}, ${m[1]}`;
}

const CATEGORY_PLURAL: Record<string, string> = {
  SUV: "SUVs",
  Sedan: "sedans",
  Pickup: "pickups",
};

interface TurnStep {
  id: string;
  label: string;
  status: "active" | "done";
}

/**
 * Real reasoning steps from the tool-call parts in the stream (task
 * 028, part 3). A step appears when its first tool call starts and
 * ticks to done when every call of that kind has its result. No timers.
 */
function turnSteps(parts: Part[]): TurnStep[] {
  const groups: { id: string; label: string; parts: Part[] }[] = [];
  const rank = parts.filter((p) => p.type === "tool-rank_category");
  const local = parts.filter((p) => p.type === "tool-local_units");
  const own = parts.filter((p) => p.type === "tool-ownership_math");
  if (rank.length > 0) {
    const input = rank[0]?.input as { category?: string } | undefined;
    const output = rank.find((p) => p.state === "output-available")
      ?.output as RankOutput | undefined;
    const category = output?.category ?? input?.category;
    const plural = category ? (CATEGORY_PLURAL[category] ?? category) : null;
    groups.push({
      id: "rank",
      label: plural
        ? `Ranking gas ${plural} by 5-year resale`
        : "Ranking picks by 5-year resale",
      parts: rank,
    });
  }
  if (local.length > 0) {
    const input = local[0]?.input as { zip?: string } | undefined;
    const output = local.find((p) => p.state === "output-available")
      ?.output as LocalOutput | undefined;
    const zip = output?.zip ?? input?.zip;
    groups.push({
      id: "local",
      label: zip ? `Finding units near ${zip}` : "Finding units near you",
      parts: local,
    });
  }
  if (own.length > 0) {
    groups.push({
      id: "own",
      label: "Working out payments and walk-away costs",
      parts: own,
    });
  }
  return groups.map((g) => ({
    id: g.id,
    label: g.label,
    status: g.parts.every(
      (p) => p.state === "output-available" || p.state === "output-error",
    )
      ? "done"
      : "active",
  }));
}

const AREA_STORAGE_KEY = "lowkey-area";
const GEO_ERROR = "Couldn't get your location. Type a ZIP instead.";

function loadStoredArea(): SearchArea | null {
  try {
    const raw = window.localStorage.getItem(AREA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SearchArea>;
    if (!parsed.zip || !/^\d{5}$/.test(parsed.zip)) return null;
    return {
      zip: parsed.zip,
      city: parsed.city ?? null,
      state: parsed.state ?? null,
      approximate: false,
    };
  } catch {
    return null;
  }
}

function persistArea(next: SearchArea) {
  try {
    window.localStorage.setItem(
      AREA_STORAGE_KEY,
      JSON.stringify({ zip: next.zip, city: next.city, state: next.state }),
    );
  } catch {
    // Storage is best-effort only (task 030, part 1).
  }
}

export default function HomeClient({
  initialArea,
}: {
  initialArea: SearchArea | null;
}) {
  const { messages, sendMessage, status, error } = useChat();
  const [aprText, setAprText] = useState<string | null>(null);
  const [walk, setWalk] = useState<WalkSelection | null>(null);
  const [bodyPick, setBodyPick] = useState<string[]>([]);
  const [isNarrow, setIsNarrow] = useState(false);
  const [area, setArea] = useState<SearchArea | null>(initialArea);
  const [zipOpen, setZipOpen] = useState(initialArea === null);
  const [zipInput, setZipInput] = useState("");
  const [pendingBody, setPendingBody] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // A returning visitor's confirmed area wins over the header guess.
  useEffect(() => {
    const stored = loadStoredArea();
    if (stored) {
      setArea(stored);
      setZipOpen(false);
    }
  }, []);

  useEffect(() => {
    if (zipOpen) zipInputRef.current?.focus();
  }, [zipOpen]);

  useEffect(() => {
    let live = true;
    fetch("/api/apr")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { label?: string } | null) => {
        if (live && j?.label) setAprText(j.label);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  let footerMeta: { soldVehicles: number; providerAsOf: string } | null = null;
  for (const message of messages) {
    for (const part of (message.parts ?? []) as Part[]) {
      if (part.type !== "tool-rank_category" || part.state !== "output-available") continue;
      const out = part.output as RankOutput;
      if (out.soldVehicles && out.providerAsOf) {
        footerMeta = {
          soldVehicles: out.soldVehicles,
          providerAsOf: out.providerAsOf,
        };
      }
    }
  }

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const steps = busy
    ? turnSteps((lastAssistant?.parts ?? []) as Part[])
    : [];

  function send(text: string) {
    if (!text.trim() || busy) return;
    setWalk(null);
    void sendMessage({ text });
  }

  function applyArea(next: SearchArea) {
    const confirmed: SearchArea = { ...next, approximate: false };
    setArea(confirmed);
    persistArea(confirmed);
    setZipOpen(false);
    setZipInput("");
    setGeoError(null);
    if (pendingBody) {
      const body = pendingBody;
      setPendingBody(null);
      send(`${confirmed.zip}, ${body}`);
    }
  }

  function handleUseLocation() {
    if (busy || geoBusy) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      setGeoError(GEO_ERROR);
      return;
    }
    setGeoBusy(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        void fetch(`/api/geo?lat=${lat}&lon=${lon}`)
          .then((r) => (r.ok ? r.json() : null))
          .then(
            (data: { zip?: string; city?: string | null; state?: string | null } | null) => {
              if (data?.zip && /^\d{5}$/.test(data.zip)) {
                applyArea({
                  zip: data.zip,
                  city: data.city ?? null,
                  state: data.state ?? null,
                });
              } else {
                setGeoError(GEO_ERROR);
              }
            },
          )
          .catch(() => setGeoError(GEO_ERROR))
          .finally(() => setGeoBusy(false));
      },
      () => {
        setGeoError(GEO_ERROR);
        setGeoBusy(false);
      },
      { timeout: 8000 },
    );
  }

  async function handleZipSubmit(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip) || geoBusy) return;
    setGeoBusy(true);
    setGeoError(null);
    try {
      const res = await fetch(`/api/geo?zip=${zip}`);
      const data = res.ok
        ? ((await res.json().catch(() => null)) as {
            city?: string | null;
            state?: string | null;
          } | null)
        : null;
      applyArea({ zip, city: data?.city ?? null, state: data?.state ?? null });
    } catch {
      applyArea({ zip, city: null, state: null });
    } finally {
      setGeoBusy(false);
    }
  }

  function handleBodyPick(label: string) {
    if (busy) return;
    setBodyPick([label]);
    if (area) {
      setPendingBody(null);
      if (area.approximate) {
        const confirmed: SearchArea = { ...area, approximate: false };
        setArea(confirmed);
        persistArea(confirmed);
      } else {
        persistArea(area);
      }
      send(`${area.zip}, ${label}`);
    } else {
      setPendingBody(label);
      setZipOpen(true);
      // The field may already be open (no-area opening), in which
      // case the zipOpen effect does not re-run; focus explicitly.
      requestAnimationFrame(() => zipInputRef.current?.focus());
    }
  }

  return (
    <MotionConfig reducedMotion="user">
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <KeyIcon />
          <span>Low Key</span>
        </div>
        <span className="tagline">No ads · No sign-up</span>
      </header>

      <div className="messages">
        {walk && !isNarrow ? (
          <WalkAwayView
            pick={walk.pick}
            ownership={{
              price: walk.ownership.price,
              downPayment: walk.ownership.downPayment,
              aprPercent: walk.ownership.aprPercent,
              termMonths: walk.ownership.termMonths,
              monthlyPayment: walk.ownership.monthlyPayment,
              curve: walk.ownership.curve ?? [],
              monthly: (walk.ownership.monthly ?? []).map((p) => ({
                month: p.month,
                getBack: p.getBack,
                costPerMonth: p.costPerMonth,
              })),
              walkAway: walk.ownership.walkAway.map((p) => ({
                month: p.month,
                getBack: p.getBack ?? 0,
                costPerMonth: p.costPerMonth ?? p.perMonth,
              })),
              evenMonth:
                walk.ownership.evenMonth !== undefined
                  ? walk.ownership.evenMonth
                  : (walk.ownership.underwaterMonth ?? null),
            }}
            aprText={walk.aprText}
            onBack={() => setWalk(null)}
          />
        ) : (
          <>
            {messages.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-5">
                <RevealText
                  as="h1"
                  text="Get a car without regret."
                  className="block text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance"
                />
                <Typography variant="label-lg" className="mt-3">
                  We help you buy for value and quality: the signal, not the noise.
                </Typography>
                <Typography variant="paragraph-md" className="mt-2">
                  Pick a body type and I&apos;ll show you the new gas cars near you that hold their value best, what each costs a month, and what it would cost you to change your mind.
                </Typography>
                <Typography variant="paragraph-sm" className="mt-2 text-muted-foreground">
                  No ads · No sign-up · Not paid by dealers.
                </Typography>
              </div>
            ) : null}

            <MessageGroup>
              {messages.map((message) => {
                const parts = (message.parts ?? []) as Part[];
                const ranks: RankOutput[] = [];
                const ownershipByModel = new Map<string, OwnershipOutput>();
                const localByModel = new Map<string, LocalOutput>();
                for (const part of parts) {
                  if (!part.type.startsWith("tool-") || part.state !== "output-available") continue;
                  const name = toolName(part.type);
                  if (name === "rank_category") ranks.push(part.output as RankOutput);
                  if (name === "ownership_math") {
                    const out = part.output as OwnershipOutput & { make?: string | null };
                    if (out.model) ownershipByModel.set(modelKey(out.model, out.make), out);
                  }
                  if (name === "local_units") {
                    const out = part.output as LocalOutput & { make?: string | null };
                    if (out.model) localByModel.set(modelKey(out.model, out.make), out);
                  }
                }
                const texts = parts.filter((p) => p.type === "text" && p.text);
                const isUser = message.role === "user";
                return (
                  <Message key={message.id} align={isUser ? "end" : "start"}>
                    <MessageContent>
                      {texts.map((part, i) =>
                        isUser ? (
                          <MessageBubble key={i} variant="primary">
                            {part.text}
                          </MessageBubble>
                        ) : (
                          <MessageBubble key={i} variant="default">
                            <StreamingText text={part.text ?? ""} speed={36} />
                          </MessageBubble>
                        ),
                      )}
                      {ranks.map((rank, ri) => {
                        const shown = [...rank.picks];
                        const commodity = rank.commodity;
                        const badged = commodity
                          ? shown.some((p) => p.model === commodity.model)
                          : true;
                        if (commodity && !badged) shown.push({ ...commodity });
                        const entries = shown.map((pick) => ({
                          pick: {
                            ...pick,
                            flag:
                              commodity && pick.model === commodity.model
                                ? commodity.flag
                                : pick.flag,
                          },
                          ownership: ownershipByModel.get(modelKey(pick.model, pick.make)),
                        }));
                        const closing = closingLine(entries, rank.category);
                        return (
                          <div key={ri} className="w-full">
                            {entries.map(({ pick, ownership }) => (
                              <PickCard
                                key={`${pick.make}-${pick.model}`}
                                pick={pick}
                                ownership={ownership}
                                local={localByModel.get(modelKey(pick.model, pick.make))}
                                peers={shown}
                                category={rank.category}
                                onWalkAway={
                                  ownership
                                    ? () =>
                                        setWalk({
                                          pick,
                                          ownership,
                                          aprText:
                                            ownership.aprLabel ??
                                            aprText ??
                                            `${ownership.aprPercent}% APR`,
                                        })
                                    : undefined
                                }
                              />
                            ))}
                            {closing ? (
                              <MessageBubble variant="default">{closing}</MessageBubble>
                            ) : null}
                          </div>
                        );
                      })}
                    </MessageContent>
                  </Message>
                );
              })}
            </MessageGroup>

            {busy ? (
              steps.length > 0 ? (
                <ReasoningSteps defaultOpen>
                  <ReasoningStepsTrigger />
                  <ReasoningStepsContent>
                    {steps.map((s) => (
                      <ReasoningStep key={s.id} label={s.label} status={s.status} />
                    ))}
                  </ReasoningStepsContent>
                </ReasoningSteps>
              ) : (
                <ThinkingIndicator words={["Thinking"]} className="text-sm" />
              )
            ) : null}
            {error ? (
              <div role="alert" className="text-sm text-destructive">
                Something went wrong. Please try again.
              </div>
            ) : null}
            <div className="mt-4">
              {zipOpen ? (
                <div>
                  <Typography variant="paragraph-md" className="font-medium">
                    {area
                      ? `Searching near ${areaPlaceLabel(area)}`
                      : "Where are you shopping?"}
                  </Typography>
                  <form
                    className="mt-2 flex flex-wrap items-center gap-2"
                    onSubmit={(e) => void handleZipSubmit(e)}
                  >
                    <label className="sr-only" htmlFor="lowkey-zip">
                      ZIP code
                    </label>
                    <input
                      id="lowkey-zip"
                      ref={zipInputRef}
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="ZIP code"
                      aria-label="ZIP code"
                      maxLength={5}
                      value={zipInput}
                      disabled={busy || geoBusy}
                      onChange={(e) =>
                        setZipInput(
                          e.target.value.replace(/\D/g, "").slice(0, 5),
                        )
                      }
                      className="min-h-11 w-32 rounded-lg border border-input bg-card px-3 text-base"
                    />
                    <button
                      type="submit"
                      disabled={
                        busy || geoBusy || zipInput.trim().length !== 5
                      }
                      className="min-h-11 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                      Use this ZIP
                    </button>
                    {area ? (
                      <button
                        type="button"
                        disabled={busy || geoBusy}
                        onClick={() => setZipOpen(false)}
                        className="min-h-11 rounded-lg border border-input px-3 text-sm font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </form>
                  <button
                    type="button"
                    disabled={busy || geoBusy}
                    onClick={handleUseLocation}
                    className="mt-2 min-h-11 rounded-lg border border-input px-3 text-sm font-medium disabled:opacity-50"
                  >
                    {geoBusy ? "Locating…" : "Use my location"}
                  </button>
                  {pendingBody && !area ? (
                    <Typography
                      variant="paragraph-sm"
                      className="mt-2 text-muted-foreground"
                    >
                      Your ZIP, so we can find units nearby
                    </Typography>
                  ) : null}
                </div>
              ) : area ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span>
                    Searching near <strong>{areaPlaceLabel(area)}</strong>
                    {area.approximate ? " (approximate)" : ""}
                  </span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    disabled={busy || geoBusy}
                    onClick={() => {
                      setZipInput(area.zip);
                      setGeoError(null);
                      setZipOpen(true);
                    }}
                    className="min-h-11 font-medium underline underline-offset-2 disabled:opacity-50"
                  >
                    Change
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    disabled={busy || geoBusy}
                    onClick={handleUseLocation}
                    className="min-h-11 font-medium underline underline-offset-2 disabled:opacity-50"
                  >
                    {geoBusy ? "Locating…" : "Use my location"}
                  </button>
                </div>
              ) : null}
              {geoError ? (
                <div
                  role="alert"
                  className="mt-2 text-sm text-destructive"
                >
                  {geoError}
                </div>
              ) : null}
            </div>
            <ToggleGroup
              aria-label="Car type"
              variant="outline"
              multiple={false}
              value={bodyPick}
              disabled={busy}
              onValueChange={(next) => {
                const picked = next[0];
                if (!picked || busy) return;
                handleBodyPick(picked);
              }}
              className="mt-3 w-full"
            >
                {(
                  [
                    ["Sedan", "sedan"],
                    ["SUV", "suv"],
                    ["Pickup", "pickup"],
                  ] as const
                ).map(([label, kind]) => (
                  <ToggleGroupItem
                    key={kind}
                    value={label}
                    className="h-auto min-h-11 flex-1 px-1 py-2"
                  >
                    <span className="flex flex-col items-center gap-1">
                      <CarFigure kind={kind} className="w-[104px]" />
                      <span>{label}</span>
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
          </>
        )}
      </div>

      {walk && isNarrow ? (
        <Drawer
          open
          direction="bottom"
          handleOnly
          onOpenChange={(open) => {
            if (!open) setWalk(null);
          }}
        >
          <DrawerContent>
            <DrawerHeader className="flex items-start justify-between gap-2">
              <div>
                <DrawerTitle>If I change my mind</DrawerTitle>
                <DrawerDescription>
                  {walk.pick.make} {walk.pick.model}
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="flex size-11 shrink-0 items-center justify-center"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </DrawerClose>
            </DrawerHeader>
            <DrawerBody>
              <WalkAwayView
                hideHeader
                pick={walk.pick}
                ownership={{
                  price: walk.ownership.price,
                  downPayment: walk.ownership.downPayment,
                  aprPercent: walk.ownership.aprPercent,
                  termMonths: walk.ownership.termMonths,
                  monthlyPayment: walk.ownership.monthlyPayment,
                  curve: walk.ownership.curve ?? [],
                  monthly: (walk.ownership.monthly ?? []).map((p) => ({
                    month: p.month,
                    getBack: p.getBack,
                    costPerMonth: p.costPerMonth,
                  })),
                  walkAway: walk.ownership.walkAway.map((p) => ({
                    month: p.month,
                    getBack: p.getBack ?? 0,
                    costPerMonth: p.costPerMonth ?? p.perMonth,
                  })),
                  evenMonth:
                    walk.ownership.evenMonth !== undefined
                      ? walk.ownership.evenMonth
                      : (walk.ownership.underwaterMonth ?? null),
                }}
                aprText={walk.aprText}
                onBack={() => setWalk(null)}
              />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      ) : null}

      <div className="sticky bottom-0 border-t border-border bg-background py-3">
        <AIInput
          placeholder="Ask a question, or type a ZIP and body type"
          showMessages={false}
          disabled={busy}
          onSend={(message) => send(message)}
        />
        <Typography variant="paragraph-xs" className="mt-2 text-muted-foreground">
          Payment assumes 10% down, 60 months
          {aprText ? <>, {aprText}</> : null} — say “my rate is 5.9%” in the chat to change it. Insurance and repairs are extra.
        </Typography>
        {footerMeta ? (
          <Typography variant="paragraph-xs" className="mt-1 text-muted-foreground">
            Rankings from {footerMeta.soldVehicles.toLocaleString("en-US")} sold
            vehicles, as of {footerDate(footerMeta.providerAsOf)} · Local stock live.
          </Typography>
        ) : null}
      </div>
    </main>
    </MotionConfig>
  );
}
