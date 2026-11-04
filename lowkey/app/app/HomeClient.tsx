"use client";

import { useChat } from "@ai-sdk/react";
import { MotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { CarFigure } from "@/components/hairline/CarFigure";
import { CarSheet, type SheetCar } from "@/components/CarSheet";
import { CreditBlock, CREDIT_POINTS } from "@/components/CreditBlock";
import { ListingSheet } from "@/components/ListingSheet";
import { RenderSpec } from "@/components/render/registry";
import { TextFallback } from "@/components/render/TextFallback";
import WalkAwayView from "@/components/WalkAwayView";
import { AIInput } from "@/components/ui/ai-input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/b-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/b-popover";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
import {
  areaAfterSearch,
  areaPlaceLabel,
  confirmArea,
  lookupWithRetry,
  parseStoredArea,
  resolveInitialArea,
  serializeStoredArea,
  type GeoLookupResult,
  type SearchArea,
} from "@/lib/geo";
import { STILL_LOOKING_AFTER_MS } from "@/lib/geo";
import {
  checkCostCompareSpec,
  checkListingSpec,
  checkPickCardSpec,
} from "@/lib/render/guard";
import { isCatalogValid } from "@/lib/render/validate";
import {
  buildCostCompareSpec,
  buildListingSpec,
  buildPickCardSpec,
  turnLabels,
  type SpecEntry,
  type SpecOwnership,
} from "@/lib/render/specs";
import {
  DEFAULT_SORT,
  isSortKey,
  sortFacts,
  type SortKey,
  type SortableFacts,
} from "@/lib/chooser";
import type { DealInputs } from "@/lib/deal";
import {
  LAST_SEARCH_KEY,
  initialSearch,
  restoreAction,
  resultsLink,
  resumeHeading,
  searchMessage,
  searchQuery,
  serializeLastSearch,
  typeFromCategory,
  typeLabel,
  type SavedSearch,
} from "@/lib/search";
import type { Spec } from "@json-render/core";
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
  currentYear?: number;
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
  taxAmount?: number;
  taxStatus?: "included" | "none" | "unknown";
  taxNotice?: string | null;
  priceSource?: "local" | "typical" | "given";
  priceLabel?: string | null;
  typicalPrice?: number | null;
  loanAmount?: number;
  downPayment: number;
  aprPercent: number;
  termMonths: number;
  monthlyPayment: number;
  positiveEquityMonth?: number | null;
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
  /** Task 041: assumptions for pricing another local unit. */
  dealInputs?: DealInputs;
}

interface LocalOutput {
  model?: string | null;
  zip?: string;
  bestPrice?: number | null;
  bestDealer?: string | null;
  unitsFound?: number;
  totalFound?: number;
  radiusUsed?: number;
  widened?: boolean;
  error?: string | null;
  fuel?: {
    text: string;
    perMonth: number;
    low: number;
    high: number;
    seriesDisplay: string;
    latestDate: string;
  } | null;
  recommendedTrim?: string | null;
  baseTrim?: string | null;
  trimUsed?: string | null;
  fellBackToBase?: boolean;
  units: {
    dealer: string;
    distanceMiles: number;
    daysOnLot?: number | null;
    year?: number | null;
    trim?: string | null;
    price: number;
    url: string;
    vin?: string | null;
  }[];
}

type Part = {
  type: string;
  text?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  data?: unknown;
};

/** Tool output -> spec-builder ownership (task 034). */
function toSpecOwnership(o: OwnershipOutput | undefined): SpecOwnership | undefined {
  if (!o) return undefined;
  return {
    price: o.price,
    taxAmount: o.taxAmount,
    taxStatus: o.taxStatus,
    taxNotice: o.taxNotice,
    downPayment: o.downPayment,
    loanAmount: o.loanAmount ?? o.price + (o.taxAmount ?? 0) - o.downPayment,
    monthlyPayment: o.monthlyPayment,
    aprPercent: o.aprPercent,
    termMonths: o.termMonths,
    positiveEquityMonth:
      o.positiveEquityMonth ?? o.evenMonth ?? o.underwaterMonth ?? null,
    evenMonth: o.evenMonth ?? o.underwaterMonth ?? null,
    underwaterMonth: o.underwaterMonth ?? null,
    curve: o.curve ?? [],
    dealInputs: o.dealInputs,
  };
}

const loggedGuardDrops = new Set<string>();

/** A failed spec is dropped and logged without data (task 034). */
function logGuardDrop(kind: string) {
  if (loggedGuardDrops.has(kind)) return;
  loggedGuardDrops.add(kind);
  console.error("lowkey: dropped a render spec that failed the number guard");
}

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

/** The public repo: the code, the data sources and the credits. */
const REPO_URL = "https://github.com/ngoldbla/cv-meta-hackathon-2026";

function GitHubIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
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
        ? `Comparing gas ${plural} by 5-year resale`
        : "Comparing cars by 5-year resale",
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
const SEARCHED_STORAGE_KEY = "lowkey-searched";
const GEO_ERROR = "Couldn't get your location. Type a ZIP instead.";

function loadSearched(): boolean {
  try {
    return window.localStorage.getItem(SEARCHED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSearched() {
  try {
    window.localStorage.setItem(SEARCHED_STORAGE_KEY, "1");
  } catch {
    // Best-effort only, like the stored area.
  }
}

const SORT_STORAGE_KEY = "lowkey-sort";

/** The chooser's sort, remembered for the session (task 040). */
function loadSort(): SortKey {
  try {
    const v = window.sessionStorage.getItem(SORT_STORAGE_KEY);
    return isSortKey(v) ? v : DEFAULT_SORT;
  } catch {
    return DEFAULT_SORT;
  }
}

function persistSort(key: SortKey) {
  try {
    window.sessionStorage.setItem(SORT_STORAGE_KEY, key);
  } catch {
    // Best-effort only.
  }
}

/** One open sheet: which turn's lineup, and which car in it. */
interface SheetState {
  turn: string;
  model: string;
}

/** One open listing sheet (task 041): the turn, the car, the unit. */
interface ListingState {
  turn: string;
  model: string;
  url: string;
}

/** The last search, remembered for the next visit (task 041). */
function persistLastSearch(s: SavedSearch) {
  try {
    window.localStorage.setItem(LAST_SEARCH_KEY, serializeLastSearch(s));
  } catch {
    // Best-effort only.
  }
}

function forgetLastSearch() {
  try {
    window.localStorage.removeItem(LAST_SEARCH_KEY);
  } catch {
    // Best-effort only.
  }
}

function loadLastSearch(): string | null {
  try {
    return window.localStorage.getItem(LAST_SEARCH_KEY);
  } catch {
    return null;
  }
}

/** The search a finished turn ran: its category and the ZIP searched. */
function searchOfParts(parts: Part[]): SavedSearch | null {
  let type: SavedSearch["type"] | null = null;
  let zip: string | null = null;
  for (const part of parts) {
    if (part.state !== "output-available") continue;
    if (part.type === "tool-rank_category") {
      type = typeFromCategory((part.output as { category?: string } | undefined)?.category);
    }
    if (part.type === "tool-local_units" && !zip) {
      const z = (part.output as { zip?: string } | undefined)?.zip;
      if (z && /^\d{5}$/.test(z)) zip = z;
    }
  }
  return type && zip ? { zip, type } : null;
}

/**
 * The open listing sheet (task 041). Builds the unit's spec from the
 * turn's tool results and runs the number guard; a failure closes
 * nothing but shows the plain dealer link instead of the figures.
 */
function ListingFromEntries({
  entries,
  listing,
  wide,
  resultsUrl,
  onClose,
}: {
  entries: Map<string, SpecEntry[]>;
  listing: ListingState;
  wide: boolean;
  resultsUrl: string;
  onClose: () => void;
}) {
  const entry = (entries.get(listing.turn) ?? []).find(
    (e) => e.pick.model === listing.model,
  );
  if (!entry) return null;
  const spec = buildListingSpec(entry, listing.url);
  const ok = Boolean(
    spec && isCatalogValid(spec) && checkListingSpec(spec, entry).ok,
  );
  if (spec && !ok) logGuardDrop("listing");
  const unit = (entry.local?.units ?? []).find((u) => u.url === listing.url);
  const props = (ok && spec ? spec.elements[spec.root]?.props : null) as
    | { title: string; dealer: string; miles: number }
    | null;
  const title = props?.title ?? `${entry.pick.make} ${entry.pick.model}`;
  const subtitle = unit
    ? `${unit.dealer} · ${Math.round(unit.distanceMiles)} mi away`
    : "";
  return (
    <ListingSheet title={title} subtitle={subtitle} wide={wide} onClose={onClose}>
      {ok && spec ? (
        <RenderSpec spec={spec} resultsUrl={resultsUrl} />
      ) : (
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block min-h-11 py-3 underline"
        >
          Open dealer&apos;s listing (opens the dealer&apos;s site)
        </a>
      )}
    </ListingSheet>
  );
}

function loadStoredArea(): SearchArea | null {
  try {
    return parseStoredArea(window.localStorage.getItem(AREA_STORAGE_KEY));
  } catch {
    return null;
  }
}

function persistArea(next: SearchArea) {
  try {
    window.localStorage.setItem(AREA_STORAGE_KEY, serializeStoredArea(next));
  } catch {
    // Storage is best-effort only (task 030, part 1).
  }
}

/**
 * The open sheet (task 040). A child component so it reads the decks
 * after the message list has filled them in the same render.
 */
function SheetFromDecks({
  decks,
  sheet,
  wide,
  onChange,
}: {
  decks: Map<string, SheetCar[]>;
  sheet: SheetState;
  wide: boolean;
  onChange: (next: SheetState | null) => void;
}) {
  const cars = decks.get(sheet.turn) ?? [];
  const index = cars.findIndex((c) => c.model === sheet.model);
  if (index < 0) return null;
  return (
    <CarSheet
      cars={cars}
      index={index}
      wide={wide}
      onIndex={(i) => {
        const car = cars[i];
        if (car) onChange({ turn: sheet.turn, model: car.model });
      }}
      onClose={() => onChange(null)}
    />
  );
}

export default function HomeClient({
  initialArea,
}: {
  initialArea: SearchArea | null;
}) {
  const { messages, sendMessage, status, error } = useChat();
  const [aprText, setAprText] = useState<string | null>(null);
  const [walk, setWalk] = useState<WalkSelection | null>(null);
  // Chooser (task 040): page-owned sort, open sheet, and the sheet to
  // return to after "If I change my mind".
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [returnSheet, setReturnSheet] = useState<SheetState | null>(null);
  // Listing sheet (task 041) and the car sheet to return to after it.
  const [listing, setListing] = useState<ListingState | null>(null);
  const [listingReturn, setListingReturn] = useState<SheetState | null>(null);
  // Resumable results (task 041): the search on screen, and the
  // search restored from a link or the last visit.
  const [current, setCurrent] = useState<SavedSearch | null>(null);
  const [resumed, setResumed] = useState<SavedSearch | null>(null);
  // The remembered search, offered on the resume card until tapped.
  const [resumeOffer, setResumeOffer] = useState<SavedSearch | null>(null);
  const [origin, setOrigin] = useState("");
  const restoredRef = useRef(false);
  const [bodyPick, setBodyPick] = useState<string[]>([]);
  const [isNarrow, setIsNarrow] = useState(false);
  const [area, setArea] = useState<SearchArea | null>(initialArea);
  const [zipOpen, setZipOpen] = useState(initialArea === null);
  const [zipInput, setZipInput] = useState("");
  const [pendingBody, setPendingBody] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoSlow, setGeoSlow] = useState(false);
  // Credit block (task 038): full until the first search, then one line.
  const [creditOpen, setCreditOpen] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Stored-area precedence (task 032, part 1): confirmed wins over
  // the header guess; unconfirmed yields to a fresh guess.
  useEffect(() => {
    const resolved = resolveInitialArea(loadStoredArea(), initialArea);
    if (resolved) {
      setArea(resolved);
      setZipOpen(false);
    }
  }, [initialArea]);

  useEffect(() => {
    if (zipOpen) zipInputRef.current?.focus();
  }, [zipOpen]);

  useEffect(() => {
    setSort(loadSort());
  }, []);

  function chooseSort(key: SortKey) {
    setSort(key);
    persistSort(key);
  }

  /** Run a saved search fresh, under "Your SUVs near 60614". */
  function runSaved(search: SavedSearch) {
    setResumeOffer(null);
    setResumed(search);
    setCurrent(search);
    setArea((a) =>
      a && a.zip === search.zip ? a : { zip: search.zip, city: null, state: null },
    );
    setZipOpen(false);
    setBodyPick([typeLabel(search.type)]);
    void sendMessage({ text: searchMessage(search) });
  }

  // Task 041: a search in the URL (a shared or reopened link) runs on
  // open. The remembered last search waits for one tap on the resume
  // card, so a return visit spends nothing until asked. Numbers are
  // never restored from storage; the fast path always runs again.
  useEffect(() => {
    setOrigin(window.location.origin);
    if (restoredRef.current) return;
    restoredRef.current = true;
    const init = initialSearch(window.location.search, loadLastSearch());
    if (!init) return;
    if (init.sort) chooseSort(init.sort);
    if (restoreAction(init) === "run") runSaved(init.search);
    else setResumeOffer(init.search);
    // Runs once on open; sendMessage is stable for the session.
  }, []);

  function forgetSaved() {
    forgetLastSearch();
    setResumeOffer(null);
  }

  // When a turn finishes, the URL and the remembered search follow it.
  useEffect(() => {
    if (status !== "ready") return;
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    const ran = last ? searchOfParts((last.parts ?? []) as Part[]) : null;
    if (!ran) return;
    setCurrent(ran);
    persistLastSearch(ran);
  }, [status, messages]);

  useEffect(() => {
    if (!current) return;
    try {
      window.history.replaceState(null, "", searchQuery(current, sort));
    } catch {
      // Some embedded views refuse history changes; the search still works.
    }
  }, [current, sort]);

  function closeListing() {
    setListing(null);
    if (listingReturn) {
      setSheet(listingReturn);
      setListingReturn(null);
    }
  }

  function closeWalk() {
    setWalk(null);
    if (returnSheet) {
      setSheet(returnSheet);
      setReturnSheet(null);
    }
  }

  // First visit: credit block open. After a search: remembered shut.
  useEffect(() => {
    setCreditOpen(!loadSearched());
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      markSearched();
      setCreditOpen(false);
    }
  }, [messages.length]);

  // "Still looking…" after 3 s of a location lookup (task 034).
  useEffect(() => {
    if (!geoBusy) {
      setGeoSlow(false);
      return;
    }
    const t = setTimeout(() => setGeoSlow(true), STILL_LOOKING_AFTER_MS);
    return () => clearTimeout(t);
  }, [geoBusy]);

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
  let footerTax: string | null = null;
  let footerAprPct: number | null = null;
  const lifespanSources = new Map<string, string>();
  const gasSources = new Map<string, string>();
  for (const message of messages) {
    for (const part of (message.parts ?? []) as Part[]) {
      if (part.type === "tool-rank_category" && part.state === "output-available") {
        const out = part.output as RankOutput;
        if (out.soldVehicles && out.providerAsOf) {
          footerMeta = {
            soldVehicles: out.soldVehicles,
            providerAsOf: out.providerAsOf,
          };
        }
        for (const pick of out.picks ?? []) {
          if (pick.lifespanSource) {
            lifespanSources.set(
              pick.lifespanSource,
              pick.lifespanAsOf ?? "",
            );
          }
        }
        if (out.commodity?.lifespanSource) {
          lifespanSources.set(
            out.commodity.lifespanSource,
            out.commodity.lifespanAsOf ?? "",
          );
        }
      }
      if (part.type === "tool-ownership_math" && part.state === "output-available") {
        const out = part.output as OwnershipOutput;
        if (out.taxNotice) footerTax = out.taxNotice;
        footerAprPct = out.aprPercent;
      }
      if (part.type === "tool-local_units" && part.state === "output-available") {
        const out = part.output as LocalOutput;
        if (out.fuel) {
          gasSources.set(out.fuel.seriesDisplay, out.fuel.latestDate);
        }
      }
    }
  }
  const hasResults = messages.some((m) =>
    ((m.parts ?? []) as Part[]).some(
      (p) => p.type === "tool-rank_category" && p.state === "output-available",
    ),
  );

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const steps = busy
    ? turnSteps((lastAssistant?.parts ?? []) as Part[])
    : [];

  function send(text: string) {
    if (!text.trim() || busy) return;
    setWalk(null);
    setSheet(null);
    setReturnSheet(null);
    setListing(null);
    setListingReturn(null);
    setResumed(null);
    setResumeOffer(null);
    void sendMessage({ text });
  }

  function applyArea(next: SearchArea) {
    const confirmed = confirmArea(next);
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
        void (async () => {
          try {
            // A bare or failed lookup retries once (task 032, part 2).
            const data = await lookupWithRetry(
              async (): Promise<GeoLookupResult | null> => {
                const res = await fetch(`/api/geo?lat=${lat}&lon=${lon}`);
                if (!res.ok) return null;
                return (await res
                  .json()
                  .catch(() => null)) as GeoLookupResult | null;
              },
            );
            if (data?.zip && /^\d{5}$/.test(data.zip)) {
              applyArea({
                zip: data.zip,
                city: data.city ?? null,
                state: data.state ?? null,
              });
            } else {
              // Failure leaves the current area as it was.
              setGeoError(GEO_ERROR);
            }
          } catch {
            setGeoError(GEO_ERROR);
          } finally {
            setGeoBusy(false);
          }
        })();
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
      // A bare or failed lookup retries once (task 032, part 2);
      // a second bare result still confirms the typed ZIP alone.
      const data = await lookupWithRetry(
        async (): Promise<GeoLookupResult | null> => {
          const res = await fetch(`/api/geo?zip=${zip}`);
          if (!res.ok) return null;
          return (await res
            .json()
            .catch(() => null)) as GeoLookupResult | null;
        },
      );
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
      // Searching does not confirm a guessed area (task 032, part 1).
      persistArea(areaAfterSearch(area));
      send(`${area.zip}, ${label}`);
    } else {
      setPendingBody(label);
      setZipOpen(true);
      // The field may already be open (no-area opening), in which
      // case the zipOpen effect does not re-run; focus explicitly.
      requestAnimationFrame(() => zipInputRef.current?.focus());
    }
  }

  // Each turn's cards in chooser order, filled while rendering the
  // messages below and read by the sheet after them (task 040).
  const decks = new Map<string, SheetCar[]>();
  // Each turn's spec entries, read by the listing sheet (task 041).
  const turnEntries = new Map<string, SpecEntry[]>();
  const shareUrl = current && origin ? resultsLink(origin, current, sort) : origin;

  return (
    <MotionConfig reducedMotion="user">
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <KeyIcon />
          <span>
            lowkey<span className="brand-tld">.autos</span>
          </span>
        </div>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="lowkey.autos code and credits on GitHub (opens in a new tab)"
          title="Code and credits on GitHub"
          className="grid size-11 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <GitHubIcon />
        </a>
      </header>

      <div className="messages">
        {walk && !isNarrow ? (
          <WalkAwayView
            pick={walk.pick}
            ownership={{
              price: walk.ownership.price,
              taxAmount: walk.ownership.taxAmount,
              taxNotice: walk.ownership.taxNotice,
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
              positiveEquityMonth:
                walk.ownership.positiveEquityMonth ??
                walk.ownership.evenMonth ??
                walk.ownership.underwaterMonth ??
                null,
            }}
            aprText={walk.aprText}
            onBack={closeWalk}
          />
        ) : (
          <>
            {resumed ? (
              <Typography variant="paragraph-md" className="font-medium">
                {resumeHeading(resumed)}
              </Typography>
            ) : null}
            {messages.length === 0 && !resumed ? (
              <div className="rounded-xl border border-border bg-card p-5">
                <RevealText
                  as="h1"
                  text="Get a car without regret."
                  className="block text-[30px] leading-[1.15] font-semibold tracking-[-0.02em] text-balance"
                />
                <Typography variant="label-lg" className="mt-3">
                  We help you buy for value and quality: the signal, not the noise.
                </Typography>
              </div>
            ) : null}
            {messages.length === 0 && resumeOffer ? (
              <section
                aria-label="Pick up where you left off"
                className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
              >
                <div className="flex flex-col gap-1">
                  <Typography variant="paragraph-sm" className="text-muted-foreground">
                    Pick up where you left off
                  </Typography>
                  <Typography variant="paragraph-md" className="font-medium">
                    {resumeHeading(resumeOffer)}
                  </Typography>
                  <Typography variant="paragraph-sm" className="text-muted-foreground">
                    Prices and stock are checked again when you tap.
                  </Typography>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => runSaved(resumeOffer)}
                    className="min-h-11"
                  >
                    Show them again
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={forgetSaved}
                    className="min-h-11 text-muted-foreground"
                  >
                    Start fresh
                  </Button>
                </div>
              </section>
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
                const serverCards = new Map<string, Spec>();
                let serverCompare: Spec | null = null;
                for (const part of parts) {
                  if (part.type !== "data-lowkey-spec") continue;
                  const d = part.data as
                    | { kind?: string; model?: string; spec?: Spec }
                    | undefined;
                  if (d?.kind === "card" && d.model && d.spec) {
                    serverCards.set(d.model, d.spec);
                  }
                  if (d?.kind === "compare" && d.spec) serverCompare = d.spec;
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
                        const turnKey = `${message.id}-${ri}`;
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
                        // Cards render only from specs (task 034): the
                        // server's fast-path specs when present, else
                        // the same pure builders over the tool-result
                        // parts. Every spec passes the number guard
                        // first; a failure drops to text.
                        const specEntries: SpecEntry[] = entries.map(
                          ({ pick, ownership }) => ({
                            pick,
                            ownership: toSpecOwnership(ownership),
                            local: localByModel.get(
                              modelKey(pick.model, pick.make),
                            ),
                          }),
                        );
                        turnEntries.set(turnKey, specEntries);
                        const labels = turnLabels(specEntries);
                        const openListing = (model: string, url: string) => {
                          if (sheet) {
                            setListingReturn(sheet);
                            setSheet(null);
                          }
                          setListing({ turn: turnKey, model, url });
                        };
                        const compareSpec =
                          serverCompare ??
                          buildCostCompareSpec(specEntries, rank.category);
                        const compareCheck = compareSpec
                          ? isCatalogValid(compareSpec)
                            ? checkCostCompareSpec(compareSpec, specEntries)
                            : { ok: false, failures: [] }
                          : null;
                        if (compareSpec && !compareCheck?.ok) {
                          logGuardDrop("compare");
                        }
                        const openWalk = (target: (typeof entries)[number]) => {
                          if (!target.ownership) return;
                          if (sheet) {
                            setReturnSheet(sheet);
                            setSheet(null);
                          }
                          setWalk({
                            pick: target.pick,
                            ownership: target.ownership,
                            aprText:
                              target.ownership.aprLabel ??
                              aprText ??
                              `${target.ownership.aprPercent}% APR`,
                          });
                        };
                        const cards: SheetCar[] = entries.map((e, ei) => {
                          const { pick } = e;
                          const entry = specEntries[ei]!;
                          const spec =
                            serverCards.get(pick.model) ??
                            buildPickCardSpec(
                              entry,
                              shown,
                              rank.category,
                              labels.get(pick.model) ?? [],
                            );
                          const check = isCatalogValid(spec)
                            ? checkPickCardSpec(spec, entry)
                            : { ok: false, failures: [] as never[] };
                          if (!check.ok) logGuardDrop("card");
                          const node = check.ok ? (
                            <RenderSpec
                              spec={spec}
                              onWalkAway={(model) => {
                                const target = entries.find(
                                  (x) => x.pick.model === model,
                                );
                                if (target) openWalk(target);
                              }}
                              onListing={openListing}
                              resultsUrl={shareUrl}
                            />
                          ) : (
                            <TextFallback
                              entry={entry}
                              peers={shown}
                              category={rank.category}
                              onWalkAway={
                                e.ownership ? () => openWalk(e) : undefined
                              }
                            />
                          );
                          return {
                            model: pick.model,
                            title: `${pick.make} ${pick.model}`,
                            node,
                          };
                        });
                        const chooserOk = Boolean(compareSpec && compareCheck?.ok);
                        if (chooserOk && compareSpec) {
                          // The sheet follows the chooser's order.
                          const rows = (
                            compareSpec.elements[compareSpec.root]?.props as {
                              rows: (SortableFacts & { model: string })[];
                            }
                          ).rows;
                          const order = sortFacts(rows, sort).map((r) => r.model);
                          decks.set(turnKey, [
                            ...order
                              .map((m) => cards.find((c) => c.model === m))
                              .filter((c): c is SheetCar => Boolean(c)),
                            ...cards.filter((c) => !order.includes(c.model)),
                          ]);
                        }
                        return (
                          <div key={ri} className="w-full">
                            {chooserOk && compareSpec ? (
                              <RenderSpec
                                spec={compareSpec}
                                sort={sort}
                                onSort={chooseSort}
                                onOpen={(model) =>
                                  setSheet({ turn: turnKey, model })
                                }
                              />
                            ) : (
                              // Fewer than two comparable cars (still
                              // streaming, or a failed spec): the cards
                              // show inline, unnumbered.
                              cards.map((c) => (
                                <div key={c.model}>{c.node}</div>
                              ))
                            )}
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
            {busy && !hasResults ? (
              <div aria-hidden="true" className="mt-3 flex flex-col gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            ) : null}
            {error ? (
              <Alert
                appearance="destructive"
                timeout={0}
                dismissible={false}
                width="100%"
                message="Something went wrong. Please try again."
                className="mt-2"
              />
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
                    <div className="w-32">
                      <Input
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
                        className="min-h-11"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={
                        busy || geoBusy || zipInput.trim().length !== 5
                      }
                      className="min-h-11"
                    >
                      Use this ZIP
                    </Button>
                    {area ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || geoBusy}
                        onClick={() => setZipOpen(false)}
                        className="min-h-11"
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </form>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || geoBusy}
                    onClick={handleUseLocation}
                    className="mt-2 min-h-11"
                  >
                    {geoBusy ? (
                      <>
                        <Spinner size="sm" /> Locating…
                      </>
                    ) : (
                      "Use my location"
                    )}
                  </Button>
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
                  <Button
                    type="button"
                    variant="link"
                    linkUnderline="static"
                    disabled={busy || geoBusy}
                    onClick={() => {
                      setZipInput(area.zip);
                      setGeoError(null);
                      setZipOpen(true);
                    }}
                    className="min-h-11 underline underline-offset-2"
                  >
                    Change
                  </Button>
                  <span aria-hidden="true">·</span>
                  <Button
                    type="button"
                    variant="link"
                    linkUnderline="static"
                    disabled={busy || geoBusy}
                    onClick={handleUseLocation}
                    className="min-h-11 underline underline-offset-2"
                  >
                    {geoBusy ? (
                      <>
                        <Spinner size="sm" /> Locating…
                      </>
                    ) : (
                      "Use my location"
                    )}
                  </Button>
                </div>
              ) : null}
              {geoBusy && geoSlow ? (
                <p role="status" className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner size="sm" /> Still looking…
                </p>
              ) : null}
              {geoError ? (
                <Alert
                  appearance="destructive"
                  timeout={0}
                  dismissible={false}
                  width="100%"
                  message={geoError}
                  className="mt-2"
                />
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-end">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 shrink-0 text-xs underline underline-offset-2"
                  >
                    Why no photos?
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" className="w-[min(20rem,calc(100vw-2rem))] p-3 text-sm leading-relaxed">
                  <strong className="font-semibold">
                    {CREDIT_POINTS[4]!.lead}
                  </strong>{" "}
                  {CREDIT_POINTS[4]!.text}
                </PopoverContent>
              </Popover>
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
            {messages.length === 0 ? (
              // Confirmed fix 1 (task 040): the area line and the type
              // buttons come first; how Low Key works sits under them.
              <div className="mt-4 rounded-xl border border-border bg-card px-5 pb-4">
                <CreditBlock open={creditOpen} onOpenChange={setCreditOpen} />
                <Typography variant="paragraph-sm" className="mt-2 text-muted-foreground">
                  No ads · No sign-up · Not paid by dealers.
                </Typography>
              </div>
            ) : null}
          </>
        )}
      </div>

      {listing && !walk ? (
        <ListingFromEntries
          entries={turnEntries}
          listing={listing}
          wide={!isNarrow}
          resultsUrl={shareUrl}
          onClose={closeListing}
        />
      ) : null}

      {sheet && !walk && !listing ? (
        <SheetFromDecks
          decks={decks}
          sheet={sheet}
          wide={!isNarrow}
          onChange={setSheet}
        />
      ) : null}

      {walk && isNarrow ? (
        <Drawer
          open
          direction="bottom"
          handleOnly
          onOpenChange={(open) => {
            if (!open) closeWalk();
          }}
        >
          <DrawerContent>
            <DrawerHeader className="flex flex-row items-start justify-between gap-2 text-left">
              <div>
                <DrawerTitle>If I change my mind</DrawerTitle>
                <DrawerDescription>
                  {walk.pick.make} {walk.pick.model}
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Close"
                  className="size-11 shrink-0"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <DrawerBody>
              <WalkAwayView
                hideHeader
                pick={walk.pick}
                ownership={{
                  price: walk.ownership.price,
                  taxAmount: walk.ownership.taxAmount,
                  taxNotice: walk.ownership.taxNotice,
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
                  positiveEquityMonth:
                    walk.ownership.positiveEquityMonth ??
                    walk.ownership.evenMonth ??
                    walk.ownership.underwaterMonth ??
                    null,
                }}
                aprText={walk.aprText}
                onBack={closeWalk}
              />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      ) : null}

      <div className="sticky bottom-0 z-10 border-t border-border bg-background py-3">
        <AIInput
          placeholder="Ask a question, or type a ZIP and body type"
          showMessages={false}
          disabled={busy}
          onSend={(message) => send(message)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Typography variant="paragraph-xs" className="text-muted-foreground">
            10% down · 60 mo
            {footerAprPct !== null ? <> · {footerAprPct}% APR</> : null}
            {footerTax?.startsWith("Includes") ? <> · est. tax incl.</> : null}
          </Typography>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 text-xs underline underline-offset-2"
              >
                Sources &amp; assumptions
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              className="w-[min(22rem,calc(100vw-2rem))] p-3 text-sm leading-relaxed"
            >
              <div className="flex flex-col gap-2">
                <p>
                  Payment assumes 10% down (of the price with fees), 60
                  months
                  {aprText ? <>, {aprText}</> : null} — say “my rate is
                  5.9%” in the chat to change it.
                  {footerTax?.startsWith("Includes")
                    ? " Sales tax is financed in the loan."
                    : ""}{" "}
                  Insurance and repairs are extra.
                </p>
                {footerTax ? <p>{footerTax}</p> : null}
                <p>
                  “Keeps about N%” is what you&apos;d likely get selling
                  after 5 years, as a share of the price.
                </p>
                {footerMeta ? (
                  <p>
                    Rankings from{" "}
                    {footerMeta.soldVehicles.toLocaleString("en-US")} sold
                    vehicles, as of {footerDate(footerMeta.providerAsOf)} ·
                    Local stock live.
                  </p>
                ) : null}
                {[...lifespanSources.entries()].map(([source, asOf]) => (
                  <p key={source}>
                    Lifespan: {source}
                    {asOf ? `, as of ${asOf}` : ""}.
                  </p>
                ))}
                {[...gasSources.entries()].map(([display, latest]) => (
                  <p key={display}>
                    Gas: {display}, as of {footerDate(latest)}.
                  </p>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </main>
    </MotionConfig>
  );
}
