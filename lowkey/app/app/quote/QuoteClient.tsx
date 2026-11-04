"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { QuoteCheck } from "@/components/QuoteCheck";
import { AppBar } from "@/components/screens/Chrome";
import { useSearch } from "@/components/screens/useSearch";
import { carsOf, modelKey, quotePicksOf } from "@/lib/resultView";
import { carPath, isSearchType, parseView, resultsPath, searchApiQuery } from "@/lib/routes";

/**
 * Got the VIN? on its own screen (tasks 046, 049). Opened from a car or
 * a listing, the search behind it supplies the picks (same terms), with
 * that car chosen; opened from the header, it compares on the defaults.
 */
export default function QuoteClient() {
  const router = useRouter();
  const params = useSearchParams();
  const typeRaw = params.get("type");
  const type = isSearchType(typeRaw) ? typeRaw : null;
  const view = parseView(params);
  const slug = params.get("car");
  const openDealId = params.get("deal");
  const state = useSearch(type && view ? searchApiQuery(type, view) : null);
  const [fred, setFred] = useState<{ aprPercent: number; label: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/apr")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { label?: string; aprPercent?: number } | null) => {
        if (live && j?.label && typeof j.aprPercent === "number") setFred({ aprPercent: j.aprPercent, label: j.label });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const data = state.status === "ready" ? state.data : null;
  const picks = useMemo(() => (data ? quotePicksOf(data) : []), [data]);
  const car = data && slug ? carsOf(data).find((c) => c.slug === slug) ?? null : null;
  const initialPickKey = car ? modelKey(car.pick.model, car.pick.make) : null;
  const fallback = type && view ? (slug ? carPath(type, slug, view) : resultsPath(type, view)) : "/";
  const apr = data?.aprPercent ?? fred?.aprPercent ?? 8;
  const aprText = data?.aprLabel ?? (view?.terms.apr != null ? `${view.terms.apr}% APR` : fred?.label ?? `${apr}% APR`);
  // Wait for the search behind a car link, so the pick is chosen when the form opens.
  const waiting = Boolean(type && view) && state.status === "loading";

  return (
    <main className="shell">
      <AppBar title="Got the VIN?" fallback={fallback} />
      {waiting ? null : (
        <QuoteCheck
          key={`${initialPickKey ?? "none"}|${openDealId ?? ""}`}
          openDealId={openDealId}
          inline
          wide={false}
          onClose={() => router.push(fallback)}
          picks={picks}
          initialPickKey={initialPickKey}
          aprPercent={apr}
          aprText={aprText}
          downRule={data?.downRule}
          termMonths={data?.termMonths}
        />
      )}
    </main>
  );
}
