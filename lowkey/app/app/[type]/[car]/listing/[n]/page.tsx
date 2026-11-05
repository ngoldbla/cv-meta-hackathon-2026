import { notFound } from "next/navigation";
import { Suspense } from "react";

import type { Metadata } from "next";

import { isSearchType } from "@/lib/routes";
import { cardPath } from "@/lib/seo";

import ListingClient from "./ListingClient";

/** Listing pages are not indexed (task 060). */
export const metadata: Metadata = {
  title: "A local listing",
  robots: { index: false, follow: true },
  openGraph: { images: [cardPath()] },
};

/** `/sedan/honda-civic-sedan/listing/1?zip=30263` (task 049). */
export default async function ListingPage({ params }: { params: Promise<{ type: string; car: string; n: string }> }) {
  const { type, car, n } = await params;
  // A local unit's place (1-3), or a far-away unit's VIN (task 054).
  const index = Number(n);
  const vin = /^[A-HJ-NPR-Z0-9]{17}$/.test(n) ? n : null;
  const local = Number.isInteger(index) && index >= 1 && index <= 3;
  if (!isSearchType(type) || !/^[a-z0-9-]{1,80}$/.test(car) || (!local && !vin)) notFound();
  return (
    <Suspense fallback={null}>
      <ListingClient type={type} slug={car} n={vin ?? index} />
    </Suspense>
  );
}
