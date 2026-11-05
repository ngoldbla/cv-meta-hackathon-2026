import type { MetadataRoute } from "next";

import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name}: ${BRAND.slogan.replace(/\.$/, "")}`,
    short_name: BRAND.name,
    description: BRAND.slogan,
    start_url: "/",
    display: "standalone",
    background_color: BRAND.colors.paper,
    theme_color: BRAND.colors.paper,
    icons: [
      { src: BRAND.icon.png192, sizes: "192x192", type: "image/png" },
      { src: BRAND.icon.png512, sizes: "512x512", type: "image/png" },
      { src: BRAND.icon.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
