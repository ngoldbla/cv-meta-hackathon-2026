"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/b-button";
import { Typography } from "@/components/ui/typography";
import { saveDeal, storageAvailable } from "@/lib/deals";
import type { VinRetention } from "@/lib/quote/benchmark";
import type { Quote } from "@/lib/quote/schema";
import { shareUrl } from "@/lib/quote/shareLink";

/** Save as my deal / Share (task 059). A deal with unchecked photo fields can't be saved or shared. */
export function DealActions({
  quote,
  retention,
  canSave,
}: {
  quote: Quote;
  retention: VinRetention | null;
  /** True once the quote has enough to compare (a price). */
  canSave: boolean;
}) {
  const [status, setStatus] = useState("");
  const [storage, setStorage] = useState(true);
  const pending = quote.unconfirmed.length > 0;
  useEffect(() => setStorage(storageAvailable()), []);

  const save = () => {
    const r = saveDeal(quote, retention);
    setStatus(
      r.ok
        ? "Saved as your deal. Results and car pages now compare against it."
        : r.reason === "unavailable"
          ? "Saving isn't available in this browser."
          : "Check the highlighted fields first.",
    );
  };

  const share = async () => {
    const url = shareUrl(window.location.origin, quote);
    if (!url) return setStatus("This deal is too long to share as a link.");
    try {
      if (navigator.share) {
        await navigator.share({ url, title: "A deal to look at" });
        return setStatus("");
      }
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      setStatus("");
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-label="Save or share this deal">
      <div className="grid grid-cols-2 gap-2">
        {storage ? (
          <Button type="button" className="min-h-11" disabled={!canSave || pending} onClick={save}>
            Save as my deal
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className={`min-h-11 ${storage ? "" : "col-span-2"}`}
          disabled={!canSave || pending}
          onClick={() => void share()}
        >
          Share
        </Button>
      </div>
      <Typography variant="paragraph-xs" className="text-muted-foreground" aria-live="polite">
        {status ||
          (pending
            ? "Check the highlighted fields first."
            : storage
              ? "Saved on this device. A shared link holds the car and the numbers, nothing else."
              : "Saving isn't available in this browser. You can still share a link.")}
      </Typography>
    </section>
  );
}
