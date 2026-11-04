"use client";

import { useEffect, useState } from "react";

import { DEALS_EVENT, loadDeals, type SavedDeal } from "@/lib/deals";

/** The saved deals, empty until the browser has been read (no hydration mismatch). */
export function useDeals(): { deals: SavedDeal[]; ready: boolean } {
  const [state, setState] = useState<{ deals: SavedDeal[]; ready: boolean }>({ deals: [], ready: false });
  useEffect(() => {
    const read = () => setState({ deals: loadDeals(), ready: true });
    read();
    window.addEventListener(DEALS_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(DEALS_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return state;
}
