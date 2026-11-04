"use client";

import { createContext } from "react";

import { DEFAULT_SORT, type SortKey } from "@/lib/chooser";

/**
 * Carries the chooser's sort and "open this car" callback into the
 * CostCompare catalog component (task 040). The page owns the sort so
 * the card sheet can follow the same order. Specs stay pure data.
 */
export const ChooserContext = createContext<{
  sort: SortKey;
  onSort?: (key: SortKey) => void;
  onOpen?: (modelKey: string) => void;
}>({ sort: DEFAULT_SORT });
