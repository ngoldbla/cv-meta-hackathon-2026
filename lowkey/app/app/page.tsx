"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useState, type FormEvent } from "react";

import PickCard, { type LocalLike } from "@/components/PickCard";
import WalkAwayView from "@/components/WalkAwayView";
import { AIInput } from "@/components/ui/ai-input";
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
  depPerMonth: number;
  mpg?: number | null;
  flag?: "badge" | "extra";
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

export default function Home() {
  const { messages, sendMessage, status, error } = useChat();
  const [aprText, setAprText] = useState<string | null>(null);
  const [walk, setWalk] = useState<WalkSelection | null>(null);
  const busy = status === "submitted" || status === "streaming";

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

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <KeyIcon />
          <span>Low Key</span>
        </div>
        <span className="tagline">No ads · No sign-up</span>
      </header>

      <div className="messages">
        {walk ? (
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
                <Typography variant="paragraph-md" className="mt-3">
                  Tell me your ZIP and whether you need a sedan, an SUV or a pickup. I&apos;ll show you the new gas cars near you that hold their value best, what each costs a month, and what it would cost you to change your mind.
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
          </>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border bg-background py-3">
        <AIInput
          placeholder="e.g. 60614, SUV"
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
  );
}
