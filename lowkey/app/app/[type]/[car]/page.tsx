import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BRAND } from "@/lib/brand";
import { carName } from "@/lib/catalogue";
import { isSearchType } from "@/lib/routes";
import { carDescription, cardPath, pageMetadata } from "@/lib/seo";
import { typeLabel } from "@/lib/search";

import CarClient from "./CarClient";

const SLUG = /^[a-z0-9-]{1,80}$/;

/** Title, canonical (no zip or terms) and card. The card carries the zip only so a cached monthly cost can be shown. */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; car: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { type, car } = await params;
  if (!isSearchType(type) || !SLUG.test(car)) return {};
  const sp = await searchParams;
  const zip = typeof sp.zip === "string" && /^\d{5}$/.test(sp.zip) ? sp.zip : undefined;
  const name = await carName(car);
  return pageMetadata({
    title: name,
    description: carDescription(name),
    path: `/${type}/${car}`,
    image: cardPath(undefined, { type, slug: car, zip }),
  });
}

/** `/sedan/honda-civic-sedan?zip=30263` (task 049). */
export default async function CarPage({ params }: { params: Promise<{ type: string; car: string }> }) {
  const { type, car } = await params;
  if (!isSearchType(type) || !SLUG.test(car)) notFound();
  const name = await carName(car);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: BRAND.name, item: BRAND.url },
      { "@type": "ListItem", position: 2, name: typeLabel(type), item: `${BRAND.url}/${type}` },
      { "@type": "ListItem", position: 3, name, item: `${BRAND.url}/${type}/${car}` },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Suspense fallback={null}>
        <CarClient type={type} slug={car} />
      </Suspense>
    </>
  );
}
