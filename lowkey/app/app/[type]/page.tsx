import { notFound } from "next/navigation";
import { Suspense } from "react";

import { isSearchType } from "@/lib/routes";

import ResultsClient from "./ResultsClient";

/** `/sedan?zip=30263` and the other four types (task 049). */
export default async function ResultsPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!isSearchType(type)) notFound();
  return (
    <Suspense fallback={null}>
      <ResultsClient type={type} />
    </Suspense>
  );
}
