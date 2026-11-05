# SEO, share cards and AI access (task 060)

The brand kit lives once in `lowkey/app/lib/brand.ts` (name, slogan, colours, icon paths, URL). Page rules live in `lib/seo.ts`. Import from those; do not repeat strings.

## Adding a page
1. Export metadata with `pageMetadata({ title, description, path, image })` (static page) or from `generateMetadata` (route with params). The root layout adds the ` · lowkey.autos` suffix, so give a plain title.
2. `path` is the canonical path with no query. The canonical never carries `zip`, `down`, `downPct`, `apr`, `term` or `sort`.
3. Descriptions carry no figures and never name the listings provider.
4. `image` is `cardPath("Page name")`: the card shows the page name and the slogan beneath it. Names only, from the route or the catalogue.
5. Add the path to `app/sitemap.ts` if it should be indexed. Pages that should not be indexed pass `noindex: true` (listing pages do). `/api/*` and `/quote` are disallowed in `app/robots.ts`.
6. Add the page to `lib/llms.ts` if it belongs in `llms.txt`. Those files hold no digits outside URLs (a test checks) and never name the listings provider.

## How the share card gets its figure
`/og` draws the card (1200 x 630). On a car page whose URL carries a `zip`, it asks `noCachedCost` (`lib/shareCard.ts`) for a monthly cost.
- A figure counts only if it is read from a card spec that passes the number guard (`shareCostFromCard` runs `checkPickCardSpec` first). The model writes no figure.
- The image route never calls the listings provider and stores nothing. With no `zip`, or no cached figure, the card is words-only.
- Open item (report 060): this app has no cache-only read of the provider's cached responses, so `noCachedCost` returns nothing today and every card is words-only. Wire a real source into `ShareCostSource` once one exists.

## Icons
`node scripts/make-icons.mjs` rewrites `app/icon.svg`, `app/apple-icon.png` and the PNGs in `public/icons/` from the key's geometry (`KEY_PATHS` in `lib/brand.ts`).
