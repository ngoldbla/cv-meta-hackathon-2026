import type { MetadataRoute } from "next";

import { BRAND } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/quote"] },
    sitemap: `${BRAND.url}/sitemap.xml`,
  };
}
