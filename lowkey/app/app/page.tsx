"use client";

import { useChat } from "@ai-sdk/react";
import { useState, type FormEvent } from "react";

import PickCard, { type LocalLike } from "@/components/PickCard";

interface RankOutput {
  category: string;
  picks: {
    rank: number | null;
    make: string;
    model: string;
    price: number;
    retention5y: number;
    depPerMonth: number;
    flag?: "badge" | "extra";
  }[];
  commodity: {
    rank: number | null;
    make: string;
    model: string;
    price: number;
    retention5y: number;
    depPerMonth: number;
    flag: "badge" | "extra";
  };
}

interface OwnershipOutput {
  model: string | null;
  monthlyPayment: number;
  underwaterMonth: number | null;
  walkAway: { month: number; walkAwayCost: number; perMonth: number }[];
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

export default function Home() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
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
                return (
                  <div key={ri}>
                    {shown.map((pick) => {
                      const isCommodity = pick.model === rank.commodity.model;
                      return (
                        <PickCard
                          key={`${pick.make}-${pick.model}`}
                          pick={{ ...pick, flag: isCommodity ? rank.commodity.flag : pick.flag }}
                          ownership={ownershipByModel.get(modelKey(pick.model, pick.make))}
                          local={localByModel.get(modelKey(pick.model, pick.make))}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}

        {busy ? <div className="status-line">Looking at the picks…</div> : null}
        {error ? <div className="error-line">Something went wrong. Please try again.</div> : null}
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
          Prices and stock are sample data in this build. Payment assumes 10% down, 60 months, 8% APR — say so in the chat to change them. Fuel, insurance and repairs are extra.
        </div>
      </div>
    </main>
  );
}
