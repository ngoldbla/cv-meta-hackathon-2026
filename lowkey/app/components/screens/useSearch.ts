"use client";

import { useEffect, useState } from "react";

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

export function useSearch(url: string | null): SearchState {
  const [state, setState] = useState<SearchState>({ status: "loading" });
  useEffect(() => {
    if (!url) return;
    let live = true;
    setState({ status: "loading" });
    load(url).then(
      (data) => live && setState({ status: "ready", data }),
      (e: Error) => live && setState({ status: "error", message: e.message }),
    );
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}
