"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/b-button";

/** Screens visited in this tab since it opened (client navigation only). */
let visited = 0;

/** Counts in-app navigation, so Back knows whether there is a Low Key screen behind it. */
export function NavTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    visited += 1;
  }, [pathname, search]);
  return null;
}

/** The public repo: the code, the data sources and the credits. */
const REPO_URL = "https://github.com/ngoldbla/cv-meta-hackathon-2026";

export function KeyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="14" r="4.5" stroke="currentColor" strokeWidth="2" />
      <path d="M11.2 10.8 20 2M16 6l3 3M13.5 8.5l2.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/** The start screen's header: the wordmark, About, Check a quote and the code. */
export function SiteHeader({ quoteHref = "/quote" }: { quoteHref?: string }) {
  return (
    <header className="topbar">
      <Link href="/" className="brand min-h-11 text-foreground no-underline" aria-label="lowkey.autos, start">
        <KeyIcon />
        <span>
          lowkey<span className="brand-tld">.autos</span>
        </span>
      </Link>
      <nav className="flex items-center gap-1" aria-label="Site">
        <Link
          href="/about"
          className="min-h-11 content-center whitespace-nowrap rounded-full px-2 text-sm text-foreground/70 no-underline transition-colors hover:bg-muted hover:text-foreground"
        >
          About
        </Link>
        <Link
          href={quoteHref}
          className="min-h-11 content-center whitespace-nowrap rounded-full px-2 text-sm font-medium text-foreground no-underline transition-colors hover:bg-muted"
        >
          Check a quote
        </Link>
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
      </nav>
    </header>
  );
}

/**
 * An inner screen's bar: Back, the screen's title, and an optional action.
 * Back goes back in history when there is a Low Key screen behind this one,
 * else to `fallback` (a shared link opened cold still has somewhere to go).
 */
export function AppBar({ title, fallback, right }: { title: string; fallback: string; right?: ReactNode }) {
  const router = useRouter();
  function back() {
    if (visited > 1) router.back();
    else router.push(fallback);
  }
  return (
    <header className="appbar">
      <Button type="button" variant="ghost" size="icon-lg" aria-label="Back" className="size-11 shrink-0" onClick={back}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
      {right}
    </header>
  );
}
