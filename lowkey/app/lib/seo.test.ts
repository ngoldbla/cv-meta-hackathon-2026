import { describe, expect, it } from "vitest";

import { RANK_FIXTURES, sampleUnitsFor } from "./fixtures";
import { BRAND } from "./brand";
import { LLMS_FULL_TXT, LLMS_TXT } from "./llms";
import { ownershipMath } from "./ownership";
import { buildPickCardSpec, type SpecEntry } from "./render/specs";
import { TYPES } from "./routes";
import { canonicalFor, carDescription, ROOT_METADATA as layoutMetadata, ROOT_VIEWPORT as viewport, cardPath, HOME_DESCRIPTION, HOME_TITLE, nameFromSlug, pageMetadata, TYPE_TITLE, typeDescription } from "./seo";
import { shareCostFromCard, usdLabel } from "./shareCard";
import robots from "../app/robots";
import { metadata as aboutMetadata } from "../app/about/page";
import manifest from "../app/manifest";

const withoutUrls = (s: string) => s.replace(/https?:\/\/\S+/g, "");

describe("titles and descriptions (task 060)", () => {
  it("uses the slogan once, with no subtitle and no retired line", () => {
    expect(HOME_TITLE).toBe("Low Key: Buy a car without regret");
    for (const text of [HOME_TITLE, HOME_DESCRIPTION, LLMS_TXT, LLMS_FULL_TXT]) {
      expect(text.toLowerCase()).not.toContain("what leaving costs");
    }
    expect(TYPE_TITLE.sedan).toBe("Sedans that hold their value near you");
    expect(Object.keys(TYPE_TITLE).sort()).toEqual([...TYPES].sort());
  });

  it("carries no figures in any title or description", () => {
    const all = [HOME_TITLE, HOME_DESCRIPTION, ...TYPES.flatMap((t) => [TYPE_TITLE[t], typeDescription(t)]), carDescription("Honda Civic Sedan")];
    for (const s of all) expect(s).not.toMatch(/\d|\$/);
  });

  it("turns a slug into a name", () => {
    expect(nameFromSlug("honda-civic-sedan")).toBe("Honda Civic Sedan");
  });
});

describe("every public route exports metadata and a canonical URL", () => {
  it("About", () => {
    expect(aboutMetadata.alternates?.canonical).toBe("https://lowkey.autos/about");
    expect(aboutMetadata.title).toBe("About");
  });

  it("type and car pages: the canonical drops the shopper's settings", () => {
    for (const t of TYPES) {
      const m = pageMetadata({ title: TYPE_TITLE[t], description: typeDescription(t), path: `/${t}`, image: cardPath(TYPE_TITLE[t]) });
      expect(m.alternates?.canonical).toBe(`https://lowkey.autos/${t}`);
      expect(String(m.alternates?.canonical)).not.toMatch(/zip|down|apr|term|sort|\?/);
    }
    expect(canonicalFor("/")).toBe("https://lowkey.autos");
  });

  it("the root layout sets metadataBase, a title template, Twitter card and both theme colours", () => {
    expect(String(layoutMetadata.metadataBase)).toBe("https://lowkey.autos/");
    expect((layoutMetadata.title as { template: string }).template).toBe("%s · lowkey.autos");
    expect((layoutMetadata.twitter as { card: string }).card).toBe("summary_large_image");
    expect(JSON.stringify(viewport.themeColor)).toContain("#f3f2ee");
    expect(JSON.stringify(viewport.themeColor)).toContain("#17181a");
  });

  it("noindex can be set for listing pages", () => {
    const m = pageMetadata({ title: "x", description: "y", path: "/z", image: "/og", noindex: true });
    expect(m.robots).toEqual({ index: false, follow: true });
  });
});

describe("robots and manifest", () => {
  it("allows everything except the API and the quote check, and names the sitemap", () => {
    const r = robots();
    expect(r.rules).toEqual({ userAgent: "*", allow: "/", disallow: ["/api/", "/quote"] });
    expect(r.sitemap).toBe("https://lowkey.autos/sitemap.xml");
  });

  it("the manifest uses the brand icons, one maskable", () => {
    const m = manifest();
    expect(m.icons?.map((i) => i.src)).toEqual([BRAND.icon.png192, BRAND.icon.png512, BRAND.icon.maskable512]);
    expect(m.icons?.[2]?.purpose).toBe("maskable");
  });
});

describe("llms.txt and llms-full.txt", () => {
  it("lead with the slogan, link the full text, and say figures come from code", () => {
    expect(LLMS_TXT.split("\n").find((l) => l.startsWith(">"))).toContain(BRAND.slogan);
    expect(LLMS_TXT).toContain("/llms-full.txt");
    expect(LLMS_TXT).toContain("computed by code and never written by a language model");
  });

  it("contain no digits other than those in URLs", () => {
    for (const text of [LLMS_TXT, LLMS_FULL_TXT]) expect(withoutUrls(text)).not.toMatch(/\d/);
  });
});

function sedanEntry(): SpecEntry {
  const pick = RANK_FIXTURES.Sedan.picks[0]!;
  const own = ownershipMath({ price: pick.price, tax: pick.price * 0.0898, down: pick.price * 0.1, apr: 8, term: 60, retention5y: pick.retention5y });
  return {
    pick: { ...pick, lifespanYears: 12, lifespanMiles: 144000, lifespanSource: "x", lifespanAsOf: "2026", recommendedTrim: "LX", baseTrim: "LX", currentYear: 2026 },
    ownership: {
      price: own.price, taxAmount: own.taxAmount, taxStatus: "included", taxNotice: "n", downPayment: own.downPayment, loanAmount: own.loanAmount,
      monthlyPayment: own.monthlyPayment, aprPercent: own.aprPercent, termMonths: own.termMonths, evenMonth: own.evenMonth, curve: own.curve,
    },
    local: {
      model: pick.model, fuel: { perMonth: 150 }, bestPrice: pick.price, totalFound: 9, radiusUsed: 50,
      units: sampleUnitsFor(pick.model, pick.price).map((u) => ({ ...u, year: 2026, trim: "LX" })),
    },
  } as unknown as SpecEntry;
}

describe("the share card's cost path (number guard)", () => {
  it("reads the real monthly cost from a spec that passes the guard", () => {
    const entry = sedanEntry();
    const spec = buildPickCardSpec(entry, [entry.pick], "Sedan", []);
    const cost = shareCostFromCard(spec, entry);
    expect(cost?.realMonthly).toBeGreaterThan(0);
    expect(usdLabel(1234.4)).toBe("$1,234 a month");
  });

  it("refuses a value that fails the number guard", () => {
    const entry = sedanEntry();
    const spec = buildPickCardSpec(entry, [entry.pick], "Sedan", []);
    const id = Object.keys(spec.elements).find((k) => spec.elements[k]!.type === "CostBars")!;
    (spec.elements[id]!.props as { realTotal: number }).realTotal += 40;
    expect(shareCostFromCard(spec, entry)).toBeNull();
  });
});
