import { notFound } from "next/navigation";
import { Suspense } from "react";

import { isSearchType } from "@/lib/routes";

import ListingClient from "./ListingClient";

/** `/sedan/honda-civic-sedan/listing/1?zip=30263` (task 049). */
export default async function ListingPage({ params }: { params: Promise<{ type: string; car: string; n: string }> }) {
  const { type, car, n } = await params;
  const index = Number(n);
  if (!isSearchType(type) || !/^[a-z0-9-]{1,80}$/.test(car) || !Number.isInteger(index) || index < 1 || index > 3) notFound();
  return (
    <Suspense fallback={null}>
      <ListingClient type={type} slug={car} n={index} />
    </Suspense>
  );
}
