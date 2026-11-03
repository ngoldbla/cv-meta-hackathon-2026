"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useState, type FormEvent } from "react";

import PickCard, { type LocalLike } from "@/components/PickCard";
import WalkAwayView from "@/components/WalkAwayView";
import { closingLine } from "@/lib/summary";
import type { CurveLike } from "@/components/WorthChart";

interface PickOut {
  rank: number | null;
  make: string;
  model: string;
  price: number;
  retention5y: number;
  depPerMonth: number;
  flag?: "badge" | "extra";
}

interface RankOutput {
  category: string;
  picks: PickOut[];
  commodity: PickOut & { flag: "badge" | "extra" };
}

interface OwnershipOutput {
  model: string | null;
  price: number;
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

export default function Home() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="sample-tag">SAMPLE DATA</span>
          <span className="tagline">No ads · No sign-up</span>
        </div>
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
              <div className="opening">
                <p>What&apos;s your ZIP, and do you need a sedan, an SUV or a pickup?</p>
                <p className="hint">Try: 60614, SUV — you will get the picks, the monthly cost, and what leaving would cost.</p>
              </div>
            ) : null}

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
              return (
                <div key={message.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {texts.map((part, i) => (
                    <div key={i} className={`bubble ${message.role === "user" ? "user" : "assistant"}`}>
                      {part.text}
                    </div>
                  ))}
                  {ranks.map((rank, ri) => {
                    const shown = [...rank.picks];
                    const badged = shown.some((p) => p.model === rank.commodity.model);
                    if (!badged) shown.push({ ...rank.commodity });
                    const entries = shown.map((pick) => ({
                      pick: {
                        ...pick,
                        flag:
                          pick.model === rank.commodity.model
                            ? rank.commodity.flag
                            : pick.flag,
                      },
                      ownership: ownershipByModel.get(modelKey(pick.model, pick.make)),
                    }));
                    const closing = closingLine(entries, rank.category);
                    return (
                      <div key={ri}>
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
                          <div className="bubble assistant closing-line">{closing}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {busy ? <div className="status-line">Looking at the picks…</div> : null}
            {error ? <div className="error-line">Something went wrong. Please try again.</div> : null}
          </>
        )}
      </div>

      <div className="composer">
        <form onSubmit={onSubmit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ZIP and type — e.g. 60614, SUV"
            aria-label="ZIP and car type"
          />
          <button type="submit" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
        <div className="assumptions">
          Prices and stock are sample data in this build. Payment assumes 10% down, 60 months
          {aprText ? <>, {aprText}</> : null} — say “my rate is 5.9%” in the chat to change it. Fuel, insurance and repairs are extra.
        </div>
      </div>
    </main>
  );
}
