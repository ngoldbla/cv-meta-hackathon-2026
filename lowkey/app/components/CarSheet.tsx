"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/b-button";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export interface SheetCar {
  model: string;
  title: string;
  node: ReactNode;
}

/** Horizontal travel (px) that counts as a swipe between cars. */
const SWIPE_PX = 56;

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

/**
 * The full card in a sheet (task 040, part 3): an Iconiq drawer from
 * the bottom on phones and from the right on wide screens. Previous /
 * next buttons and a horizontal swipe move between cars in the
 * chooser's current sort order. Closing returns to the chat where it
 * was; the page underneath never scrolls.
 */
export function CarSheet({
  cars,
  index,
  onIndex,
  onClose,
  wide,
}: {
  cars: SheetCar[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
  wide: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const car = cars[index];
  const prev = index > 0 ? cars[index - 1] : null;
  const next = index < cars.length - 1 ? cars[index + 1] : null;

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [index]);

  if (!car) return null;
  return (
    <Drawer
      open
      direction={wide ? "right" : "bottom"}
      handleOnly
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent size="lg">
        <DrawerHeader className="flex flex-col gap-2 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 text-left">
              <DrawerTitle className="text-left">{car.title}</DrawerTitle>
              <DrawerDescription className="mx-0 text-left">
                {wide
                  ? "Use the arrows for the other cars."
                  : "Swipe or use the arrows for the other cars."}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label="Close"
                className="size-11 shrink-0"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </Button>
            </DrawerClose>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={!prev}
              onClick={() => onIndex(index - 1)}
              aria-label={prev ? `Previous: ${prev.title}` : "No previous car"}
              className="min-h-11 min-w-0 max-w-[48%] justify-start px-2 text-xs"
            >
              <Chevron dir="left" />
              <span className="truncate">{prev ? prev.title : ""}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!next}
              onClick={() => onIndex(index + 1)}
              aria-label={next ? `Next: ${next.title}` : "No next car"}
              className="min-h-11 min-w-0 max-w-[48%] justify-end px-2 text-xs"
            >
              <span className="truncate">{next ? next.title : ""}</span>
              <Chevron dir="right" />
            </Button>
          </div>
        </DrawerHeader>
        <DrawerBody
          ref={bodyRef}
          className="touch-pan-y"
          onPointerDown={(e) => {
            start.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            const s = start.current;
            start.current = null;
            if (!s) return;
            const dx = e.clientX - s.x;
            const dy = e.clientY - s.y;
            if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            if (dx < 0 && next) onIndex(index + 1);
            if (dx > 0 && prev) onIndex(index - 1);
          }}
          onPointerCancel={() => {
            start.current = null;
          }}
        >
          <div key={car.model}>{car.node}</div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
