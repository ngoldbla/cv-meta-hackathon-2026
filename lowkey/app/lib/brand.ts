/**
 * The brand kit (task 060), written once. The header, metadata, manifest,
 * share card and JSON-LD all import from here.
 */
export const BRAND = {
  name: "Low Key",
  domain: "lowkey.autos",
  url: "https://lowkey.autos",
  slogan: "Buy a car without regret.",
  /** Title template: "%s · lowkey.autos". */
  titleSuffix: " · lowkey.autos",
  colors: {
    paper: "#f3f2ee",
    paperDark: "#17181a",
    ink: "#1b1c1e",
    brass: "#d9b96a",
  },
  /** The key icon: ink tile, light-brass key (mirrors KeyIcon in components/screens/Chrome.tsx). */
  icon: {
    svg: "/icon.svg",
    apple: "/apple-icon.png",
    png192: "/icons/icon-192.png",
    png512: "/icons/icon-512.png",
    maskable512: "/icons/icon-maskable-512.png",
  },
  repoUrl: "https://github.com/ngoldbla/cv-meta-hackathon-2026",
  /** Who answers mail (shown on /contact, /about and in the Organization markup). */
  email: "ndgold@me.com",
  /** The other names the brand goes by, so search and AI tools tie them to this site. */
  alternateNames: ["lowkey.autos", "Low Key Autos"],
  /** One plain sentence: who we are, what we do, where. Used on /about, /contact and in JSON-LD. */
  identity:
    "Low Key (lowkey.autos) is a free, independent website that helps people in the United States choose and price a new car before they buy it from a dealer.",
  areaServed: "US",
  founder: { name: "Dylan Goldblatt", url: "https://www.ndgold.com" },
} as const;

/** The key's drawing, shared by the header icon and the generated files. */
export const KEY_PATHS = {
  circle: { cx: 8, cy: 14, r: 4.5 },
  d: "M11.2 10.8 20 2M16 6l3 3M13.5 8.5l2.5 2.5",
} as const;
