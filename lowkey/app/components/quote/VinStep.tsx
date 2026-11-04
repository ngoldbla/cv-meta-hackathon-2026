"use client";

import { useState } from "react";

import { Button } from "@/components/ui/b-button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import { vinCheckOk } from "@/lib/quote/schema";

import { VinScanner } from "./VinScanner";

/**
 * Step 1 of Got the VIN? (task 059): get the VIN by scanning its
 * barcode, from a photo or PDF, or by typing it. Everything that comes
 * back is check-digit validated before it is used.
 */
export function VinStep({
  vin,
  onTypeVin,
  onVin,
  onChooseFile,
  onTakePhoto,
  onSkip,
  busy,
  message,
  canScan,
}: {
  vin: string;
  onTypeVin: (v: string) => void;
  onVin: (vin: string) => void;
  onChooseFile: () => void;
  onTakePhoto: () => void;
  onSkip: () => void;
  busy: boolean;
  message: string;
  canScan: boolean;
}) {
  const [scanning, setScanning] = useState(false);
  const [scanOff, setScanOff] = useState(false);
  const full = vin.length === 17;
  const bad = full && !vinCheckOk(vin);
  const scanAvailable = canScan && !scanOff;

  return (
    <section className="flex flex-col gap-4" aria-label="Find the car by its VIN">
      <div className="flex flex-col gap-1">
        <Typography variant="paragraph-md" className="font-medium">
          Snap or type the VIN
        </Typography>
        <Typography variant="paragraph-sm" className="text-muted-foreground">
          It&apos;s on the windshield corner, the driver&apos;s door jamb, the window sticker or the buyer&apos;s order. We
          fill in the car from it.
        </Typography>
      </div>

      {scanning ? (
        <VinScanner
          onVin={(v) => {
            setScanning(false);
            onVin(v);
          }}
          onUnavailable={() => {
            setScanning(false);
            setScanOff(true);
          }}
          onCancel={() => setScanning(false)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {scanAvailable ? (
            <Button type="button" className="min-h-11" disabled={busy} onClick={() => setScanning(true)}>
              Scan the barcode
            </Button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={scanAvailable ? "outline" : "default"} className="min-h-11" disabled={busy} onClick={onChooseFile}>
              Choose a photo or PDF
            </Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onTakePhoto}>
              Take a photo
            </Button>
          </div>
          {scanOff ? (
            <Typography variant="paragraph-xs" className="text-muted-foreground">
              The camera isn&apos;t available here. A photo or typing the VIN works too.
            </Typography>
          ) : null}
        </div>
      )}

      <Typography variant="paragraph-xs" className="text-muted-foreground" aria-live="polite">
        {message}
      </Typography>

      <label className="flex flex-col gap-1">
        <Typography variant="paragraph-xs" className="text-muted-foreground">
          Or type the 17 characters
          {bad ? " · this VIN doesn't check out; please look again" : ""}
        </Typography>
        <Input
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={17}
          value={vin}
          onChange={(e) => {
            const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
            onTypeVin(v);
            if (vinCheckOk(v)) onVin(v);
          }}
          className="min-h-11 font-mono tracking-wide"
        />
      </label>

      <Button type="button" variant="link" linkUnderline="static" className="min-h-11 self-start underline underline-offset-2" onClick={onSkip}>
        No VIN? Enter the deal anyway
      </Button>
    </section>
  );
}
