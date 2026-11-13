import { describe, expect, it } from "vitest";

import { ANSWER_PAGE, ANSWERS } from "./answers";
import { BRAND } from "./brand";
import { LLMS_FULL_TXT, LLMS_TXT } from "./llms";
import { breadcrumbJsonLd, CONTACT_DESCRIPTION, organizationJsonLd, PRIVACY_DESCRIPTION } from "./seo";
import sitemap from "../app/sitemap";

const withoutUrls = (s: string) => s.replace(/https?:\/\/\S+/g, "");

describe("answer page", () => {
  it("answers the asked question in its first paragraph and carries no figures", () => {
    expect(ANSWERS[0].q).toBe("Where can I buy a car online in the United States?");
    expect(ANSWER_PAGE.lead).toContain(BRAND.identity);
    const all = [ANSWER_PAGE.title, ANSWER_PAGE.description, ANSWER_PAGE.lead, ...ANSWERS.flatMap((x) => [x.q, ...x.a])];
    for (const s of all) expect(s).not.toMatch(/\d|\$|%/);
  });

  it("links only to pages that exist", () => {
    const known = new Set(["/", "/quote", "/about", "/contact", "/sedan", "/suv", "/pickup", "/minivan", "/hybrid"]);
    for (const x of ANSWERS) for (const [, href] of x.links ?? []) expect(known.has(href)).toBe(true);
  });
});

describe("identity and trust signals", () => {
  it("one Organization record with alternate names, contact and area", () => {
    const org = organizationJsonLd();
    expect(org.name).toBe("Low Key");
    expect(org.alternateName).toContain("lowkey.autos");
    expect(org.contactPoint.email).toBe(BRAND.email);
    expect(org.contactPoint.url).toBe("https://lowkey.autos/contact");
    expect(org.sameAs).toContain(BRAND.repoUrl);
    expect(org.description).toBe(BRAND.identity);
  });

  it("breadcrumbs start at the home page", () => {
    const b = breadcrumbJsonLd([["Privacy", "/privacy"]]);
    expect(b.itemListElement.map((i) => i.item)).toEqual(["https://lowkey.autos", "https://lowkey.autos/privacy"]);
  });

  it("descriptions carry no figures", () => {
    for (const s of [CONTACT_DESCRIPTION, PRIVACY_DESCRIPTION, BRAND.identity]) expect(s).not.toMatch(/\d|\$/);
  });

  it("the sitemap and llms.txt list the new pages", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    for (const p of ["/buy-a-car-online", "/contact", "/privacy"]) {
      expect(urls).toContain(`https://lowkey.autos${p}`);
      expect(LLMS_TXT).toContain(`https://lowkey.autos${p}`);
    }
    expect(withoutUrls(LLMS_FULL_TXT)).not.toMatch(/\d/);
    expect(LLMS_FULL_TXT).toContain(ANSWERS[0].q);
  });
});
