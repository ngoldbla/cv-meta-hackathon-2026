import Link from "next/link";
import type { ReactNode } from "react";

import { Typography } from "@/components/ui/typography";

/** The frame for plain reading pages (About, Contact, Privacy, the answer page). */
export function ReadingPage({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="min-h-11 content-center underline underline-offset-2">
          ← Back to Low Key
        </Link>
      </div>
      {children}
    </main>
  );
}

export function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2" id={id}>
      <Typography as="h2" variant="h5">
        {title}
      </Typography>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <Typography variant="paragraph-md">{children}</Typography>;
}

/** An outside link (new tab). */
export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  );
}

/** A link inside the site. */
export function L({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="underline underline-offset-2">
      {children}
    </Link>
  );
}
