import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Typography } from "@/components/ui/typography";
import licenses from "@/lib/licenses.json";

import { CopyEmail } from "./CopyEmail";

export const metadata: Metadata = {
  title: "About · lowkey.autos",
  description: "Low Key is a calm way to buy a car. How it works, how AI is used, and where the data comes from.",
};

const REPO_URL = "https://github.com/ngoldbla/cv-meta-hackathon-2026";
const GUIDE_URL = `${REPO_URL}/blob/main/lowkey/docs/roll-your-own.md`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <Typography as="h2" variant="h5">
        {title}
      </Typography>
      {children}
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <Typography variant="paragraph-md">{children}</Typography>;
}

function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  );
}

/**
 * About (task 044). Every claim here is checked against the code at
 * this commit (the table is in ops/reports/044-lowkey-about-and-credits.md).
 * The listings provider is not named on this page.
 */
export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="min-h-11 content-center underline underline-offset-2">
          ← Back to Low Key
        </Link>
      </div>

      <header className="flex flex-col gap-3">
        <Typography as="h1" variant="h3">
          About Low Key
        </Typography>
        <P>
          Low Key is a calm way to buy a car. Don&apos;t get over-invested in the decision, and be confident you made a
          good one.
        </P>
        <P>
          Pick a type of car and your ZIP, and set your own down payment, term and rate if you like. Low Key shows the new cars that hold their value best near you, what each
          really costs a month (the loan, fuel and sales tax), what it would cost to change your mind, and the lowest
          listed prices nearby. Bring a dealer&apos;s quote or a window sticker, and it checks the numbers and puts them
          next to its picks on the same terms. No account, no ads, and no money from dealers.
        </P>
      </header>

      <Section title="The hackathon">
        <P>
          An open-source entry to the Meta hackathon hosted by Cerebral Valley, Fall 2026. The code is public:{" "}
          <A href={REPO_URL}>github.com/ngoldbla/cv-meta-hackathon-2026</A>.
        </P>
      </Section>

      <Section title="How AI is used">
        <Typography as="h3" variant="label-md">
          Built with
        </Typography>
        <ul className="list-disc pl-5">
          <li>
            <P>
              <strong>Muse Code</strong> with <strong>Muse Wonder</strong> built the first phase of the app: every
              feature was written as a task file and built through the repository&apos;s task mailbox. Later tasks went
              through the same mailbox with a coding agent.
            </P>
          </li>
          <li>
            <P>
              The <strong>Hairline</strong> skill drew the line-drawn cars; the <strong>impeccable</strong> distill
              method guided the interface clean-up.
            </P>
          </li>
        </ul>
        <Typography as="h3" variant="label-md">
          At runtime
        </Typography>
        <ul className="list-disc pl-5">
          <li>
            <P>
              <strong>Muse Glimmer</strong> (30B, open weights) reads a photo of a dealer&apos;s sheet or a window
              sticker. It runs on Hugging Face Inference Providers (served by DeepInfra, which keeps no copy of the
              request), with our own serverless GPU as a backup. It copies the page and pairs
              each label with its value; plain code then finds the VIN, checks it, and picks out every number, and you
              confirm each one before anything is compared.
            </P>
          </li>
          <li>
            <P>
              There is no chat. You choose a type of car and your terms with ordinary controls, and code does the
              rest: the cards, the charts and every figure are built by code, never by a language model. A number guard
              checks each figure on a card against the data that produced it. Cards and charts render with{" "}
              <strong>json-render</strong> from a fixed component catalog; the interface uses <strong>Iconiq UI</strong>.
            </P>
          </li>
        </ul>
        <Typography as="h3" variant="label-md">
          In the weekly data pipeline
        </Typography>
        <ul className="list-disc pl-5">
          <li>
            <P>
              <strong>Timestral</strong> forecasts gas prices 52 weeks ahead, once a week.
            </P>
          </li>
        </ul>
      </Section>

      <Section title="Our belief">
        <P>
          Car buying should be easy and suit your own needs. The open-source bundle makes it simple to roll your own
          with Muse and Vercel, so you can shop with your own preferences: luxury cars, motorcycles, other markets. See
          the <A href={GUIDE_URL}>roll-your-own guide</A>.
        </P>
      </Section>

      <Section title="Data sources">
        <ul className="list-disc pl-5">
          <li>
            <P>A licensed automotive listings and sold-vehicle data provider (listings, prices, and resale history).</P>
          </li>
          <li>
            <P>
              <A href="https://www.eia.gov/petroleum/gasdiesel/">U.S. Energy Information Administration</A> (weekly
              gas prices).
            </P>
          </li>
          <li>
            <P>
              <A href="https://fred.stlouisfed.org/series/RIFLPBCIANM60NM">Federal Reserve Bank of St. Louis, FRED</A>{" "}
              (the 60-month new-car loan rate).
            </P>
          </li>
          <li>
            <P>
              <A href="https://www.fueleconomy.gov">fueleconomy.gov</A> (EPA combined MPG).
            </P>
          </li>
          <li>
            <P>
              <A href="https://geocoding.geo.census.gov">U.S. Census Bureau geocoder</A> (your area from your
              location, when you tap “Use my location”).
            </P>
          </li>
          <li>
            <P>
              State revenue and DMV pages and the <A href="https://taxfoundation.org">Tax Foundation</A> (sales tax).
            </P>
          </li>
          <li>
            <P>
              <A href="https://www.iseecars.com">iSeeCars</A> (lifespan study).
            </P>
          </li>
          <li>
            <P>
              <A href="https://vercel.com">Vercel</A> (hosting, storage, and an approximate starting area).{" "}
              <A href="https://huggingface.co/docs/inference-providers">Hugging Face Inference Providers</A> (photo
              reading). <A href="https://modal.com">Modal</A> (the reader&apos;s server and its backup GPU).
            </P>
          </li>
        </ul>
      </Section>

      <Section title="Open source used">
        <P>
          The app&apos;s direct dependencies, generated from its package lockfile, plus the models and components
          above: Muse Glimmer (Apache-2.0), Timestral (code Apache-2.0, weights Modified MIT), Iconiq UI (MIT), vLLM
          (Apache-2.0).
        </P>
        <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {licenses.map((l) => (
            <li key={l.name}>
              <Typography variant="paragraph-sm">
                {l.homepage ? <A href={l.homepage}>{l.name}</A> : l.name} {l.version} · {l.license}
              </Typography>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Thanks">
        <P>Fireworks, Hugging Face, Modal, Meta and Vercel, for their support in delivering this project.</P>
      </Section>

      <Section title="Author">
        <P>Dylan Goldblatt</P>
        <CopyEmail email="ndgold@me.com" />
        <P>
          <A href="https://www.ndgold.com">www.ndgold.com</A>
        </P>
      </Section>

      <Section title="Coming next">
        <ul className="list-disc pl-5">
          <li>
            <P>Used cars one to five years old, single owner, no accidents.</P>
          </li>
          <li>
            <P>True-shape drawings of each model, traced from photos with Meta&apos;s SAM 3.1.</P>
          </li>
          <li>
            <P>Insurance and repairs in the monthly cost.</P>
          </li>
        </ul>
      </Section>
    </main>
  );
}
