"use client";

import { createContext } from "react";

/**
 * The listing sheet's handlers (task 041). "See the car" opens the
 * in-app listing sheet instead of the dealer's site; the sheet needs
 * the results link for the deal-sheet text and reports dealer-link
 * opens. Specs stay pure data; the handlers live in the page.
 */
export const ListingContext = createContext<{
  onListing?: (modelKey: string, url: string) => void;
  /** The shareable results link (`?zip=&type=`), for the deal sheet. */
  resultsUrl?: string;
  /** Task 054: choose a unit (by VIN) as the one the shopper is going for, or clear it with null. */
  onChoose?: (modelKey: string, vin: string | null) => void;
}>({});

/** The card a DealerLine sits in, so its units know their model. */
export const CardModelContext = createContext<string | null>(null);
