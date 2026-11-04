import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";

import "./globals.css";

export const metadata: Metadata = {
  title: "Low Key — which car, what it costs, what leaving costs",
  description:
    "A chat that tells you which new gas car to buy nearby, what it costs per month, and what walking away would cost. No ads, no sign-up.",
};

const THEME_SCRIPT = `(function(){try{var m=window.matchMedia("(prefers-color-scheme: dark)");var apply=function(){document.documentElement.classList.toggle("dark",m.matches)};apply();if(m.addEventListener){m.addEventListener("change",apply)}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
