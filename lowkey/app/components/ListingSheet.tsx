"use client";

import type { ReactNode } from "react";

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

/**
 * The listing sheet (task 041, part 1): one local unit in an Iconiq
 * drawer, from the bottom on phones and the right on wide screens,
 * before the shopper ever leaves for the dealer's site. Closing
 * returns to where they were (the car's sheet, or the chat).
 */
export function ListingSheet({
  title,
  subtitle,
  wide,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  wide: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
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
        <DrawerHeader className="flex flex-row items-start justify-between gap-2 text-left">
          <div className="min-w-0 text-left">
            <DrawerTitle className="text-left">{title}</DrawerTitle>
            <DrawerDescription className="!mx-0 !text-left">{subtitle}</DrawerDescription>
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
        </DrawerHeader>
        <DrawerBody>{children}</DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
