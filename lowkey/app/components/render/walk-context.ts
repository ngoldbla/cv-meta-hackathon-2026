"use client";

import { createContext } from "react";

/**
 * Carries the "If I change my mind" callback into catalog
 * components. Specs stay pure data; the handler lives in the page.
 */
export const WalkAwayContext = createContext<{
  onWalkAway?: (modelKey: string) => void;
}>({});
