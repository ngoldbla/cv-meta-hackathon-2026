---
id: "060"
title: "Low Key: SEO, social graph and AI access"
status: open
created: 2026-11-05
report: ops/reports/060-lowkey-seo-brand-assets.md
---
# Low Key: SEO, social graph and AI access

**Branch: `task/060-seo-brand-assets` cut from `main`, with a PR into `main`.** One task, one PR.

## Why (Dylan, 2026-11-05)
The site has a colour scheme and a key icon, and nothing else: no favicon, share image, page metadata, robots, sitemap, `llms.txt` or structured data. Everything below makes the brand, search and AI-access surfaces say one thing. The slogan is **"Buy a car without regret."**

The choices were made on the decision board; they are final. The slogan has no subtitle or supporting line anywhere. The old line ("Which car, what it costs, what leaving costs") is retired, including from the current page title and description.

## The choices
1. **Icon (ink tile, light-brass key).** Reuse the `KeyIcon` geometry from `components/screens/Chrome.tsx`: ink `#1b1c1e` tile, dark-mode brass `#d9b96a` key. Produce `app/icon.svg`, `app/apple-icon.png` (180), and 192 and 512 PNGs plus a maskable 512 for the manifest. Check legibility at 16 px.
2. **Share card with a live monthly cost.** 1200 × 630, paper ground, wordmark, the slogan as the headline, no subtitle. On car pages only, add a tile with the car name and its real monthly cost.
   - The figure comes from the same tool result path as the page and passes the number guard (`lib/render/guard.ts`). The model writes no figure. Do not weaken the guard.
   - Cost is shown only when the URL carries a `zip` and the data is already in the cache. With no `zip`, or no cache hit, fall back to the words-only card. Never call the listings provider from an image route, and store nothing (AGENTS.md: no standalone listing database).
   - Home, About and type pages use the words-only card.
3. **Card per page.** Same frame on every page, with the page or car name as the headline and the slogan beneath it in a smaller size ("Sedans that hold their value", "Honda Civic Sedan"). Only names appear, taken from the routes and the catalogue. Home and About use the sitewide card.
4. **Titles.** Home: "Low Key: Buy a car without regret". Type pages: plain label, "Sedans that hold their value near you · lowkey.autos" and the same pattern for the other four types. Use a title template of "%s · lowkey.autos". Descriptions carry no figures and never name the listings provider. Replace the current root title and description in `app/layout.tsx`.
5. **Indexing.** Index `/`, `/about`, the five type pages and the car pages. Canonical URLs drop `zip`, `down`, `downPct`, `apr`, `term` and `sort`. Listing pages (`/[type]/[car]/listing/[n]`) are `noindex`. `/quote` and `/api/*` are disallowed in robots. Add `metadataBase` (`https://lowkey.autos`), `app/sitemap.ts` (home, About, type pages, car pages; no listing pages) and `app/manifest.ts`. Check that each car page has enough unique text to avoid reading as thin, and report what you found if it does not.
6. **AI crawlers.** `app/robots.ts`: `User-agent: *`, `Allow: /`, `Disallow: /api/`, `Disallow: /quote`, plus the sitemap line. No per-bot rules.
7. **`llms.txt` and `llms-full.txt`.** Route handlers at `/llms.txt` and `/llms-full.txt`, `text/plain`.
   - `llms.txt`: the site name, the slogan as the first line of the summary, the page list (Start, a type page, About, Got the VIN?), one line that every figure is computed by code and never by a model, and a link to the full text.
   - `llms-full.txt`: how the monthly cost, the cost of leaving and the resale view are worked out, how AI is used, and where the data comes from, in plain language. Build it from `lowkey/docs/why-low-key.md`, `lowkey/docs/decision-model.md` and `/about`, and invent no claims. No figures. It must not name the listings provider; refer readers to `/about` for sources.
8. **Structured data.** JSON-LD: `Organization` (with `slogan`), `WebSite` and `WebApplication` on the home page; `BreadcrumbList` on car pages (Low Key › Type › Car, built from the route). No `Product`, `Offer` or price markup.
9. **Fonts.** Move to `next/font` (self-hosted, `display: swap`, preloaded). First audit which Plex weights the CSS and components actually use, and load only those; the audit list goes in the report. Check for visible weight shifts in light and dark at 390 and 1280 before and after.
10. **Lighthouse, report only.** Run Lighthouse against the preview deploy for `/`, `/sedan?zip=…`, a car page and `/about`, mobile and desktop. Post the four scores per page in the report and in the PR description. Add no failing CI check. Record a baseline and open follow-up notes on what to tighten.
11. **Delivery.** Single branch and PR.

## Also
- Build the viewport `themeColor` for light (`#f3f2ee`) and dark (`#17181a`).
- Confirm `pdfjs-dist` and `zxing-wasm` load only on the quote route; report if not, and fix only if the change is small.
- Run Lighthouse's accessibility checks and fix issues in the surfaces touched here. List anything larger in the report instead of fixing it.
- Add Vitest coverage: every public route exports metadata and a canonical URL; robots and sitemap contents; `llms.txt` and `llms-full.txt` contain no provider name and no digits other than those in URLs; the share-card cost path refuses a value that fails the number guard.
- Docs: add the brand kit (name, slogan, colours, icon path, URL) once in `lib/brand.ts` and import it from the header, metadata, manifest, OG image and JSON-LD. Add a short `lowkey/docs/seo-and-share.md` covering how to add a page and how the share card gets its figure.

## Done when
- All items above work on the preview deploy: icons in the tab and on a phone, share cards for home, a type page and a car page (with and without `zip`), `view-source` showing correct title, canonical, OG, Twitter and JSON-LD, and `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/llms.txt`, `/llms-full.txt` all returning 200.
- Gates pass: `npm ci && npm run build` and `npm test` in `lowkey/app`, `pytest -q`, `python scripts/name_guard.py`, `python scripts/secret_guard.py --all`.
- Playwright at 390 px and 1280 px in light and dark, with no layout regressions from the font change.
- Report in `ops/reports/060-lowkey-seo-brand-assets.md`, PR into `main` with the preview URL. Nothing goes to production until Dylan merges.

## Open for Dylan (does not block the task)
- Search Console verification (meta tag or DNS) and sitemap submission need your account. The report lists the exact tag or record once the domain setup is known.
