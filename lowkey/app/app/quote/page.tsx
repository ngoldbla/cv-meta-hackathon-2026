import { Suspense } from "react";

import QuoteClient from "./QuoteClient";

export const metadata = { title: "Got the VIN?", robots: { index: false, follow: true } };

/** `/quote`, or `/quote?type=sedan&car=honda-civic-sedan&zip=30263` from a car (task 049). */
export default function QuotePage() {
  return (
    <Suspense fallback={null}>
      <QuoteClient />
    </Suspense>
  );
}
