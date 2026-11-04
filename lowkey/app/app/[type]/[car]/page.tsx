import { notFound } from "next/navigation";
import { Suspense } from "react";

import { isSearchType } from "@/lib/routes";

import CarClient from "./CarClient";

/** `/sedan/honda-civic-sedan?zip=30263` (task 049). */
export default async function CarPage({ params }: { params: Promise<{ type: string; car: string }> }) {
  const { type, car } = await params;
  if (!isSearchType(type) || !/^[a-z0-9-]{1,80}$/.test(car)) notFound();
  return (
    <Suspense fallback={null}>
      <CarClient type={type} slug={car} />
    </Suspense>
  );
}
