import type { MetadataRoute } from "next";

import { BRAND } from "@/lib/brand";
import { carRoutes } from "@/lib/catalogue";
import { TYPES } from "@/lib/routes";

/** Home, About, the five type pages and the car pages. No listing pages, no query strings. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cars = await carRoutes();
  return ["", "/about", ...TYPES.map((t) => `/${t}`), ...cars.map((c) => `/${c.type}/${c.slug}`)].map((path) => ({
    url: `${BRAND.url}${path}`,
  }));
}
