import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/JsonLd";
import { A, L, P, ReadingPage, Section } from "@/components/screens/PageShell";
import { Typography } from "@/components/ui/typography";
import { BRAND } from "@/lib/brand";
import { breadcrumbJsonLd, cardPath, CONTACT_DESCRIPTION, organizationJsonLd, pageMetadata } from "@/lib/seo";

import { CopyEmail } from "../about/CopyEmail";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: CONTACT_DESCRIPTION,
  path: "/contact",
  image: cardPath("Contact"),
});

export default function ContactPage() {
  return (
    <ReadingPage>
      <JsonLd
        data={[
          { "@context": "https://schema.org", "@type": "ContactPage", name: `Contact ${BRAND.name}`, url: `${BRAND.url}/contact`, about: { "@id": `${BRAND.url}/#organization` } },
          organizationJsonLd(),
          breadcrumbJsonLd([["Contact", "/contact"]]),
        ]}
      />
      <header className="flex flex-col gap-3">
        <Typography as="h1" variant="h3">
          Contact Low Key
        </Typography>
        <P>{BRAND.identity}</P>
      </header>

      <Section title="Email">
        <P>
          Write to <a href={`mailto:${BRAND.email}`} className="underline underline-offset-2">{BRAND.email}</a>. It reaches{" "}
          {BRAND.founder.name}, who runs Low Key. There is no phone line and no sales team.
        </P>
        <CopyEmail email={BRAND.email} />
      </Section>

      <Section title="Report a problem">
        <P>
          If a price, a figure or a page looks wrong, email the page address and what you saw. Problems with the code can
          also be raised on <A href={`${BRAND.repoUrl}/issues`}>GitHub</A>.
        </P>
      </Section>

      <Section title="What we cannot help with">
        <P>
          Low Key does not sell cars and is not a dealer, so it cannot hold a car, arrange a test drive or change a
          dealer&apos;s price. Contact the dealer listing the car for those.
        </P>
      </Section>

      <Section title="More">
        <P>
          <L href="/about">About Low Key</L> · <L href="/privacy">Privacy</L> · <L href="/buy-a-car-online">How to buy a car online</L>
        </P>
      </Section>
    </ReadingPage>
  );
}
