"use client";

import { createContext } from "react";

/**
 * The car card's title level (task 055). On a car's own screen the card
 * title is the page's one `<h1>`; elsewhere (the results fallback) it is
 * an `<h2>` under the app bar's `<h1>`.
 */
export const CardHeadingContext = createContext<"h1" | "h2">("h2");
