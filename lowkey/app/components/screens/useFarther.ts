"use client";

import { useEffect, useState } from "react";

import type { FartherResult } from "@/lib/tools";

/**
 * Far-away leads for one car (task 054), fetched only when asked for
 * (the one on-demand provider call per car) and kept for this tab.
 */
const cache = new Map<string, Promise<FartherResult>>();

export type FartherState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: FartherResult }
  | { status: "error" };

function load(url: string): Promise<FartherResult> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error("failed");
      return (await res.json()) as FartherResult;
    });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

export function useFarther(url: string | null): FartherState {
  const [state, setState] = useState<FartherState>({ status: "idle" });
  useEffect(() => {
    if (!url) {
      setState({ status: "idle" });
      return;
    }
    let live = true;
    setState({ status: "loading" });
    load(url).then(
      (data) => live && setState({ status: "ready", data }),
      () => live && setState({ status: "error" }),
    );
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}
