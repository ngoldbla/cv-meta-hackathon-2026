"use client";

import { MotionConfig } from "motion/react";
import { Suspense, type ReactNode } from "react";

import { NavTracker } from "./Chrome";

/** Client-wide settings: motion follows the system setting; Back knows the history. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <Suspense fallback={null}>
        <NavTracker />
      </Suspense>
      {children}
    </MotionConfig>
  );
}
