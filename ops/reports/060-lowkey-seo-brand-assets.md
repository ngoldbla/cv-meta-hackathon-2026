# Report 060: Low Key: SEO, social graph and AI access
Status: blocked
Branch head at start: 89c02fd  ·  at finish: (see PR head)

## Summary
Built and checked locally: brand kit, icons, per-page titles/canonicals/OG/Twitter, robots, sitemap, manifest, `llms.txt`/`llms-full.txt`, JSON-LD, theme colours, `next/font`, tests and docs. Marked **blocked** because four items could not be finished here: the share card's cost tile (no cache-only read exists), Lighthouse on a preview deploy (no preview URL from this environment), the Lighthouse accessibility pass, and the check that every gate passes (see Results). Nothing was faked: where a result is missing it says so.

## Work done
- **Brand kit:** `lib/brand.ts` (name, slogan, colours, icon paths, URL, key geometry); the header `KeyIcon` and repo link now import from it. `lib/seo.ts` holds titles, descriptions, canonical rules and the root metadata.
- **Icons (1):** `scripts/make-icons.mjs` writes `app/icon.svg`, `app/apple-icon.png` (180), `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`. Ink `#1b1c1e` tile, brass `#d9b96a` key. Checked at 16 px (rendered and viewed: the key reads as a ring and bit).
- **Share card (2, 3):** `app/og/route.tsx`, 1200 x 630, paper ground, wordmark, page name as headline, slogan beneath (home: the slogan is the headline, no subtitle). Home/About/type use words only. Car cards use the catalogue name.
- **Titles (4):** home "Low Key: Buy a car without regret"; type pages "Sedans that hold their value near you · lowkey.autos" (and the four others); template `%s · lowkey.autos`; no figures in any title/description.
- **Indexing (5, 6):** `metadataBase`, canonical per page (no query), listing pages and `/quote` `noindex`, `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`. Verified on a local production build: `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/llms.txt`, `/og` return 200.
- **llms (7):** `lib/llms.ts`, route handlers at `/llms.txt` and `/llms-full.txt` (`text/plain`). No digits outside URLs, no provider name, sources point to `/about`.
- **JSON-LD (8):** Organization (with slogan), WebSite, WebApplication on home; BreadcrumbList on car pages. No Product/Offer/price markup.
- **themeColor:** light `#f3f2ee`, dark `#17181a`.
- **Docs:** `lowkey/docs/seo-and-share.md`.
- **Tests:** `lib/seo.test.ts` (13 tests): metadata and canonicals, robots, manifest, llms contents (no digits outside URLs), and the share-card cost path refusing a tampered value.

## Results
- `npm run build` passes. `npm test`: 32 files, 368 tests pass. `python scripts/secret_guard.py --all`: clean.
- `python -m pytest -q`: 104 passed with `headless-glimmer/tests/test_headless_glimmer.py` excluded (it needs `torch`, not installed here; not run). I did not run `npm ci` (it deletes `node_modules`); I built with the installed modules.
- **`python scripts/name_guard.py` FAILS, and not because of this task:** commit `8a47c97` (the task-060 file commit, already on `main`) has an assistant-vendor name in its author metadata. This branch's own commits are authored as the repository author. Fixing it means rewriting `main` history, which AGENTS.md forbids me to do. Needs Dylan.
- **Fonts (9), audit:** Sans weights used: 400 (`font-normal`), 500 (`font-medium`), 600 (`font-semibold`, `.brand-tld`), 700 (`.brand`). Mono weights: 400, 500, 600 (`.mono` plus medium/semibold). No weight went unused, so all seven files load, latin subset only (the old CSS also loaded latin-ext and other subsets). Before/after: built `main` and this branch, screenshot `/`, `/about`, `/quote` at 390 and 1280 px, light and dark (12 pairs): **0 pixels differ** (colour distance over 30). Car and type pages could not be rendered locally (the table needs a Blob token), so they were not compared.
- **Heavy libraries:** `pdfjs-dist` and `zxing-wasm` chunks appear only in the `/quote` route's client manifest. Nothing to fix.
- **Thin-content check (5):** the car and type pages render client-side behind a `Suspense` fallback of `null`, so the server HTML holds only the title, description, canonical, OG and JSON-LD, with no body text. Search engines that run JavaScript will see the page; the others see little. Left unfixed (a larger change).

## Deviations
- The sitemap lists car pages from the depreciation table; locally the table is unreachable so it listed home, About and the five types only. Car pages appear once the table loads on the deploy.
- When the table is unreachable, a car's name falls back to the title-cased slug ("Honda Civic Sedan").

## Blocked / questions
1. **Share-card cost tile (needs Dylan):** "only when the data is already in the cache, never call the provider, store nothing" cannot be met today. Next's data cache cannot be read without a fetch that can miss and call the provider, and the app keeps no other copy. `noCachedCost` returns nothing, so every card is words-only. The guard-checked extraction (`shareCostFromCard`) is built and tested. Options: (a) accept words-only cards; (b) a short-lived in-memory figure remembered by `runSearch` per server instance (arguably "storing"); (c) have the car page pass its own already-computed figure through a signed URL. Which?
2. **Lighthouse (10):** not run. No preview deploy URL is available to me, and Lighthouse is not installed. Scores per page are still owed. The accessibility pass is owed with it.
3. **Preview checks** (icons on a phone, card previews, `view-source` on the deploy): owed until the preview exists.
4. **Search Console:** needs Dylan's account; the tag or record is unknown until the domain setup is.
