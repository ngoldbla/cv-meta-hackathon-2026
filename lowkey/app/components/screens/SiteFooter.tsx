import Link from "next/link";

import { BRAND } from "@/lib/brand";

const LINKS: [string, string][] = [
  ["How to buy a car online", "/buy-a-car-online"],
  ["About", "/about"],
  ["Contact", "/contact"],
  ["Privacy", "/privacy"],
];

/**
 * The sitewide footer, rendered on the server on every page so search
 * engines and AI tools find who runs the site, how to reach them and how
 * personal details are handled (the "trust" signals).
 */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-[720px] border-t border-border px-4 py-6 text-sm text-muted-foreground">
      <nav aria-label="Footer">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {LINKS.map(([label, href]) => (
            <li key={href}>
              <Link href={href} className="inline-flex min-h-11 items-center text-foreground/80 underline underline-offset-2">
                {label}
              </Link>
            </li>
          ))}
          <li>
            <a href={`mailto:${BRAND.email}`} className="inline-flex min-h-11 items-center text-foreground/80 underline underline-offset-2">
              {BRAND.email}
            </a>
          </li>
        </ul>
      </nav>
      <p className="mt-2">
        {BRAND.name} · {BRAND.domain}. A free, independent car-buying guide for the United States. No ads, no sign-up, no
        money from dealers.
      </p>
    </footer>
  );
}
