"use client";

import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
} from "react";

import { mountCar, type CarKind } from "@/lib/hairline/cars";

const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/* Low Key tokens on Hairline's public --hairline-* properties. */
const TOKENS = {
  "--hairline-plate": "var(--card)",
  "--hairline-hi": "var(--brass)",
  "--hairline-edge": "var(--foreground)",
  "--hairline-mid":
    "color-mix(in oklab, var(--muted-foreground) 55%, var(--background))",
  "--hairline-lo": "var(--border)",
} as CSSProperties;

export interface CarFigureProps {
  kind: CarKind;
  className?: string;
  style?: CSSProperties;
  label?: string;
  intensity?: number;
}

/**
 * One Hairline car (package figure format, never `play`: no loop, and
 * the core lands springs at once under prefers-reduced-motion).
 */
export const CarFigure = forwardRef<HTMLDivElement, CarFigureProps>(
  function CarFigure({ kind, className, style, label, intensity }, ref) {
    const el = useRef<HTMLDivElement | null>(null);
    const figure = useRef<ReturnType<typeof mountCar> | null>(null);
    const opts = useRef({ label, intensity });
    opts.current = { label, intensity };

    useIsoLayoutEffect(() => {
      if (!el.current) return;
      const f = mountCar(el.current, kind, {
        label: opts.current.label,
        intensity: opts.current.intensity,
      });
      figure.current = f;
      return () => {
        f.destroy();
        figure.current = null;
      };
      // Mounts once per kind; option changes go through update below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind]);

    useIsoLayoutEffect(() => {
      figure.current?.update({ label, intensity });
    }, [label, intensity]);

    return (
      <div
        ref={(node) => {
          el.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={className}
        style={{ aspectRatio: "5 / 4", ...TOKENS, ...style }}
      />
    );
  },
);
