/**
 * Page metadata rules (task 060). Titles and descriptions carry no figures
 * and never name the listings provider. Canonical URLs drop the shopper's
 * settings (zip, down, downPct, apr, term, sort).
 */
import type { Metadata, Viewport } from "next";

import { BRAND } from "./brand";
import type { SearchType } from "./search";

export const TYPE_TITLE: Record<SearchType, string> = {
  sedan: "Sedans that hold their value near you",
  suv: "SUVs that hold their value near you",
  pickup: "Pickups that hold their value near you",
  minivan: "Minivans that hold their value near you",
  hybrid: "Hybrids that hold their value near you",
};

export const HOME_TITLE = `${BRAND.name}: Buy a car without regret`;
export const HOME_DESCRIPTION =
  "A calm way to buy a car. See the new cars that hold their value near you, what each costs a month, and what changing your mind would cost. No ads, no sign-up.";
export const ABOUT_DESCRIPTION =
  "Low Key (lowkey.autos) is a free, independent car-buying guide for the United States. How it works, who runs it, how AI is used, and where the data comes from.";
export const CONTACT_DESCRIPTION = "How to reach Low Key (lowkey.autos): email, and where to report a problem with the site.";
export const PRIVACY_DESCRIPTION =
  "What Low Key (lowkey.autos) keeps about you, which is very little: no account, no ads, no selling of data. What stays on your device and what is sent to whom.";

/** The one Organization record: home, About and Contact all use it, so the brand is described the same way everywhere. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BRAND.url}/#organization`,
    name: BRAND.name,
    alternateName: [...BRAND.alternateNames],
    url: BRAND.url,
    slogan: BRAND.slogan,
    description: BRAND.identity,
    logo: `${BRAND.url}${BRAND.icon.png512}`,
    email: BRAND.email,
    areaServed: { "@type": "Country", name: "United States" },
    founder: { "@type": "Person", name: BRAND.founder.name, url: BRAND.founder.url },
    sameAs: [BRAND.repoUrl],
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: BRAND.email, url: `${BRAND.url}/contact`, availableLanguage: "English", areaServed: BRAND.areaServed },
  };
}

/** A breadcrumb trail from the home page: [name, path] pairs after "Low Key". */
export function breadcrumbJsonLd(trail: [string, string][]) {
  const items: [string, string][] = [[BRAND.name, "/"], ...trail];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: canonicalFor(path) })),
  };
}

export function typeDescription(type: SearchType): string {
  return `${TYPE_TITLE[type]}: the picks side by side, what each costs a month, and what leaving would cost. No ads, no sign-up.`;
}

export function carDescription(name: string): string {
  return `${name}: what it costs a month, what changing your mind would cost, and how its price compares near you. No ads, no sign-up.`;
}

/** "honda-civic-sedan" -> "Honda Civic Sedan", the fallback when the catalogue is unreachable. */
export function nameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function canonicalFor(path: string): string {
  return path === "/" ? BRAND.url : `${BRAND.url}${path}`;
}

/** Title (without the template suffix), description and path -> Metadata with canonical, OG and Twitter. */
export function pageMetadata(args: { title: string; description: string; path: string; image: string; noindex?: boolean }): Metadata {
  const { title, description, path, image } = args;
  return {
    title,
    description,
    alternates: { canonical: canonicalFor(path) },
    openGraph: { title, description, url: canonicalFor(path), siteName: BRAND.name, type: "website", images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    ...(args.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** The share-card path for a page: the headline travels in the query. */
export function cardPath(headline?: string, car?: { type: SearchType; slug: string; zip?: string }): string {
  const q = new URLSearchParams();
  if (headline) q.set("h", headline);
  if (car) {
    q.set("type", car.type);
    q.set("car", car.slug);
    if (car.zip) q.set("zip", car.zip);
  }
  const s = q.toString();
  return `/og${s ? `?${s}` : ""}`;
}

/** The sitewide metadata (the root layout re-exports it). Pages that set their own canonical override it. */
export const ROOT_METADATA: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: { default: HOME_TITLE, template: `%s${BRAND.titleSuffix}` },
  description: HOME_DESCRIPTION,
  applicationName: BRAND.name,
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: BRAND.url,
    siteName: BRAND.name,
    type: "website",
    images: [{ url: cardPath(), width: 1200, height: 630, alt: BRAND.slogan }],
  },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description: HOME_DESCRIPTION, images: [cardPath()] },
};

export const ROOT_VIEWPORT: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.colors.paper },
    { media: "(prefers-color-scheme: dark)", color: BRAND.colors.paperDark },
  ],
};
