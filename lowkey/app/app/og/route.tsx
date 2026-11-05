import { ImageResponse } from "next/og";

import { BRAND } from "@/lib/brand";
import { carName } from "@/lib/catalogue";
import { isSearchType } from "@/lib/routes";
import { noCachedCost, usdLabel } from "@/lib/shareCard";

export const runtime = "nodejs";

/**
 * The share card (task 060): 1200 x 630, paper ground, wordmark, the page
 * name as the headline and the slogan beneath it. On a car page that has a
 * zip and a cached figure, a tile adds the car and its monthly cost. This
 * route never calls the listings provider and stores nothing.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type") ?? "";
  const slug = sp.get("car") ?? "";
  const zip = sp.get("zip") ?? "";
  const isCar = isSearchType(type) && /^[a-z0-9-]{1,80}$/.test(slug);
  const name = isCar ? await carName(slug) : null;
  const headline = (name ?? (sp.get("h") ?? "").slice(0, 80)) || BRAND.slogan;
  const cost = isCar && /^\d{5}$/.test(zip) ? await noCachedCost({ type, slug, zip }) : null;
  const home = headline === BRAND.slogan;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: BRAND.colors.paper, color: BRAND.colors.ink, padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 700 }}>
          <div style={{ display: "flex", width: 64, height: 64, borderRadius: 14, background: BRAND.colors.ink, alignItems: "center", justifyContent: "center" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <circle cx="8" cy="14" r="4.5" stroke={BRAND.colors.brass} strokeWidth="2" />
              <path d="M11.2 10.8 20 2M16 6l3 3M13.5 8.5l2.5 2.5" stroke={BRAND.colors.brass} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: "flex" }}>lowkey.autos</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: home ? 92 : 80, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{headline}</div>
          {!home && <div style={{ display: "flex", fontSize: 40, color: "#5a5c60" }}>{BRAND.slogan}</div>}
        </div>
        <div style={{ display: "flex", height: 96 }}>
          {cost && name && (
            <div style={{ display: "flex", alignItems: "center", gap: 24, background: "#ffffff", border: "2px solid #d9d6cc", borderRadius: 20, padding: "0 32px", fontSize: 36 }}>
              <div style={{ display: "flex", fontWeight: 700 }}>{name}</div>
              <div style={{ display: "flex", color: "#5a5c60" }}>{usdLabel(cost.realMonthly)}</div>
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } },
  );
}
