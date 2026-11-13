import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/JsonLd";
import { A, L, P, ReadingPage, Section } from "@/components/screens/PageShell";
import { Typography } from "@/components/ui/typography";
import { BRAND } from "@/lib/brand";
import { breadcrumbJsonLd, cardPath, pageMetadata, PRIVACY_DESCRIPTION } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description: PRIVACY_DESCRIPTION,
  path: "/privacy",
  image: cardPath("Privacy"),
});

/**
 * How Low Key handles personal details. Each statement matches the code:
 * localStorage keys (AreaControl, ResultsClient, QuoteCheck, lib/deals),
 * the starting area from Vercel's request headers (lib/geo), the rounded
 * location sent to the Census geocoder (api/geo), the photo reader's
 * pass-through and per-address limit (api/quote, lib/quote/reader), and
 * Vercel Web Analytics (app/layout).
 */
export default function PrivacyPage() {
  return (
    <ReadingPage>
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "WebPage", name: "Privacy", url: `${BRAND.url}/privacy`, publisher: { "@id": `${BRAND.url}/#organization` } },
          breadcrumbJsonLd([["Privacy", "/privacy"]]),
        ]}
      />
      <header className="flex flex-col gap-3">
        <Typography as="h1" variant="h3">
          Privacy
        </Typography>
        <P>
          Low Key keeps as little about you as it can. There is no account and no sign-up, no ads, and nothing is sold or
          passed to dealers. Dealers do not know you are looking until you contact them yourself.
        </P>
        <Typography variant="paragraph-sm" className="text-muted-foreground">
          Updated 13 November 2026.
        </Typography>
      </header>

      <Section title="What stays on your device">
        <P>
          Your area, your last search, quotes you are checking and deals you save are kept in your browser&apos;s own
          storage on this device, so the site can pick up where you left off. They are not sent to us to be stored. Tap
          Forget on the start screen, or clear this site&apos;s data in your browser, to remove them.
        </P>
      </Section>

      <Section title="What is sent, and to whom">
        <ul className="list-disc pl-5">
          <li>
            <P>
              <strong>Your approximate area.</strong> Our host, Vercel, estimates a starting town and ZIP code from your
              connection. It is only a starting suggestion; you can change it.
            </P>
          </li>
          <li>
            <P>
              <strong>Searches.</strong> The type of car and your ZIP code are sent to our server and to our licensed
              listings data provider to find prices near you; the terms you set are used on our server to work out the
              costs. A VIN you enter is sent the same way to find the car.
            </P>
          </li>
          <li>
            <P>
              <strong>Use my location.</strong> If you tap it, your browser asks first. Your location, rounded, is sent
              through our server to the U.S. Census Bureau geocoder to find your ZIP code. We do not keep it.
            </P>
          </li>
          <li>
            <P>
              <strong>Photos and PDFs of a quote.</strong> These are passed through our server to the reader that copies
              the text: Hugging Face Inference Providers (served by DeepInfra, which keeps no copy of the request), or
              our own server on Modal as a backup. Low Key does not store the photo. The text read from it is held only
              briefly, so your browser can collect it. Your connection&apos;s address is used, in memory, to limit how
              often the reader can be called.
            </P>
          </li>
          <li>
            <P>
              <strong>Visit counts.</strong> Vercel Web Analytics counts page views so we can see which pages are used.
              It does not use cookies for this.
            </P>
          </li>
        </ul>
      </Section>

      <Section title="What we do not do">
        <P>
          No advertising or ad trackers, no selling or sharing of your details, no marketing email, and no money from
          dealers, makers or lenders.
        </P>
      </Section>

      <Section title="Questions">
        <P>
          Email <a href={`mailto:${BRAND.email}`} className="underline underline-offset-2">{BRAND.email}</a>, or see{" "}
          <L href="/contact">Contact</L>. The code that does all of the above is public on{" "}
          <A href={BRAND.repoUrl}>GitHub</A>.
        </P>
      </Section>
    </ReadingPage>
  );
}
