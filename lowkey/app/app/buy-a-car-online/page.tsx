import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/JsonLd";
import { L, P, ReadingPage, Section } from "@/components/screens/PageShell";
import { Typography } from "@/components/ui/typography";
import { ANSWER_PAGE, ANSWERS } from "@/lib/answers";
import { BRAND } from "@/lib/brand";
import { breadcrumbJsonLd, cardPath, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: ANSWER_PAGE.title,
  description: ANSWER_PAGE.description,
  path: ANSWER_PAGE.path,
  image: cardPath(ANSWER_PAGE.title),
});

const slug = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * The answer page: one page that answers, in its first paragraph, the
 * question AI assistants and search engines are asked about buying a car
 * online, then the follow-up questions shoppers search for. Server-rendered
 * text, so tools that do not run JavaScript can read and quote it.
 */
export default function AnswerPage() {
  const url = `${BRAND.url}${ANSWER_PAGE.path}`;
  return (
    <ReadingPage>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            name: ANSWER_PAGE.title,
            url,
            publisher: { "@id": `${BRAND.url}/#organization` },
            mainEntity: ANSWERS.map((x) => ({
              "@type": "Question",
              name: x.q,
              acceptedAnswer: { "@type": "Answer", text: x.a.join(" ") },
            })),
          },
          breadcrumbJsonLd([[ANSWER_PAGE.title, ANSWER_PAGE.path]]),
        ]}
      />
      <header className="flex flex-col gap-3">
        <Typography as="h1" variant="h3">
          {ANSWER_PAGE.title}
        </Typography>
        <P>{ANSWER_PAGE.lead}</P>
        <P>
          <L href="/">Start with your ZIP code</L>
        </P>
      </header>

      <nav aria-label="Questions on this page">
        <ul className="list-disc pl-5">
          {ANSWERS.map((x) => (
            <li key={x.q}>
              <Typography variant="paragraph-sm">
                <a href={`#${slug(x.q)}`} className="underline underline-offset-2">
                  {x.q}
                </a>
              </Typography>
            </li>
          ))}
        </ul>
      </nav>

      {ANSWERS.map((x) => (
        <Section key={x.q} title={x.q} id={slug(x.q)}>
          {x.a.map((p) => (
            <P key={p}>{p}</P>
          ))}
          {x.links ? (
            <ul className="flex flex-col gap-1">
              {x.links.map(([label, href]) => (
                <li key={href}>
                  <Typography variant="paragraph-md">
                    <L href={href}>{label}</L>
                  </Typography>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      ))}
    </ReadingPage>
  );
}
