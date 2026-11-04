"use client";

import { useEffect, useRef, useState } from "react";

import type { SearchResult } from "@/lib/searchRun";

/**
 * One search per URL (task 049). Results stay in memory for this tab, so
 * moving between the results, a car and a listing never searches twice;
 * they are never written to storage (task 041: always re-run on a visit).
 */
const cache = new Map<string, Promise<SearchResult>>();

export type SearchState =
  | { status: "loading" }
  | { status: "ready"; data: SearchResult }
  | { status: "error"; message: string };

function load(url: string): Promise<SearchResult> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(res.status === 400 ? "invalid" : "failed");
      return (await res.json()) as SearchResult;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/**
 * With `keep` (task 054: choosing a unit re-prices one car), the last
 * result stays on screen, marked `updating`, until the new one arrives.
 */
export function useSearch(url: string | null, opts: { keep?: boolean } = {}): SearchState & { updating?: boolean } {
  const [state, setState] = useState<SearchState>({ status: "loading" });
  const [updating, setUpdating] = useState(false);
  const keep = Boolean(opts.keep);
  const last = useRef<SearchState>(state);
  last.current = state;
  useEffect(() => {
    if (!url) return;
    let live = true;
    if (keep && last.current.status === "ready") setUpdating(true);
    else setState({ status: "loading" });
    load(url).then(
      (data) => {
        if (!live) return;
        setUpdating(false);
        setState({ status: "ready", data });
      },
      (e: Error) => {
        if (!live) return;
        setUpdating(false);
        setState({ status: "error", message: e.message });
      },
    );
    return () => {
      live = false;
    };
  }, [url, keep]);
  return state.status === "ready" ? { ...state, updating } : state;
}
