# 062: answer-engine and search gaps from the visibility check

Requested by Dylan directly in a session on 2026-11-13, with a third-party visibility check of lowkey.autos dated 2026-11-13. There is no task file; the reviewer may want to file one for the record.

## What the check found
| Finding | Status before |
|---|---|
| Website checks: Reach, Read, Identity, Speed in place; **Trust needs attention**: no contact details or privacy policy found on the pages read; no review or rating markup | 4 of 5 |
| AI assistants (ChatGPT, Perplexity, Google AI) asked "Where can I buy a car online in the United States?" | Named by 0 of 3 |
| Google's AI, searching the name | Describes something else ("Low Key" is ambiguous) |
| Tested searches ("car buying no ads", "buy car without regret", "new cars hold value", "buy car buying platform online united states", "cars near me by ZIP", "monthly car cost calculator") | Not in the first 20 for any |
| Suggested actions | (1) make it clear who you are: About page, organisation markup, same name everywhere; (2) publish a page that answers what customers ask, with the answer in the first paragraph; (3) get into the lists Google shows |

## What was done
1. **Trust.** New `/privacy` (each statement matched against the code: localStorage keys, Vercel area headers, rounded location to the Census geocoder, the reader pass-through and per-address limit, Vercel Web Analytics) and `/contact` (email as a `mailto:` link). A server-rendered sitewide footer (`components/screens/SiteFooter.tsx`, in `app/layout.tsx`) links the answer page, About, Contact, Privacy and the email on every page.
2. **Identity.** One sentence in `BRAND.identity` says who, what and where; it opens About, Contact, the answer page, `llms.txt` and `llms-full.txt`. One `Organization` record (`organizationJsonLd()` in `lib/seo.ts`) with `@id`, `alternateName` (lowkey.autos, Low Key Autos), description, `areaServed` United States, founder, `contactPoint` and `sameAs` (the GitHub repo), used on home, About and Contact. `AboutPage`, `ContactPage`, `WebPage` and `BreadcrumbList` on the new pages; `WebSite` now has an `@id`, `alternateName` and `publisher`.
3. **Answer page.** `/buy-a-car-online`, "How to buy a car online in the United States". The first paragraph answers the question directly (dealers make the sale; Low Key is the free, independent place to choose and price the car first). Then one answer per tested search, each opening with its direct answer, linking to the five type pages, Start and Got the VIN?. `FAQPage` JSON-LD. Content in `lib/answers.ts`; the same answers are appended to `llms-full.txt`. No figures and no listings-provider name anywhere in it.
4. Sitemap and `llms.txt` list the new pages. About's description no longer starts with "How Low Key works" but with what Low Key is.

## Checks
- `npm ci && npm run build`: pass (new routes are static).
- `npm test`: 33 files, 374 tests pass, including new `lib/answers.test.ts` (no digits in the answer copy or descriptions, links only to real pages, the Organization record, sitemap and `llms.txt` entries).
- Served the build: every page has the footer, `mailto:` and `/privacy` link in its server HTML. Screenshots at iPhone width: no horizontal scroll.
- `secret_guard.py --all`: clean.
- `name_guard.py`: fails only on two ref names from the session's working branch (it carries an assistant vendor's name and was created by the environment, not this work). Files and commits pass.
- `pytest -q`: cannot collect in this container (`torch` and `numpy` missing for `headless-glimmer` and `cloud/gas_forecast`); untouched by this change.

## Open
- **Lists Google shows (action 3):** outreach to the sites that write "best car-buying sites" lists; not a code change.
- **Social profiles:** `sameAs` holds only the GitHub repo. Add any real profiles that use the exact name "Low Key" when they exist; using the same name everywhere is what fixes the branded-search confusion.
- **Search Console and Bing Webmaster Tools:** still owed from 060; needs Dylan's account. Submit the sitemap and request indexing of `/buy-a-car-online`.
- **Reviews or ratings markup:** none added. Low Key has no reviews; adding markup without real ones would be against search-engine rules.
- **Type and car pages** still render their body client-side behind `Suspense fallback={null}` (noted in 060). The check scored "Read" as in place, but tools that do not run JavaScript see no body text there. A server-rendered intro on those pages is the next step.
- Re-run the visibility check after the deploy has been crawled.
