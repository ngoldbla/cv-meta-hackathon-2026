import { Suspense } from "react";

import QuoteClient from "./QuoteClient";

export const metadata = { title: "Got the VIN? · lowkey.autos" };

/** `/quote`, or `/quote?type=sedan&car=honda-civic-sedan&zip=30263` from a car (task 049). */
export default function QuotePage() {
  return (
    <Suspense fallback={null}>
      <QuoteClient />
    </Suspense>
  );
}
