import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { isSearchType } from "@/lib/routes";
import { cardPath, pageMetadata, TYPE_TITLE, typeDescription } from "@/lib/seo";

import ResultsClient from "./ResultsClient";

/** Title, canonical and card by type. The canonical drops zip, down, downPct, apr, term and sort. */
export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params;
  if (!isSearchType(type)) return {};
  return pageMetadata({
    title: TYPE_TITLE[type],
    description: typeDescription(type),
    path: `/${type}`,
    image: cardPath(TYPE_TITLE[type]),
  });
}

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
