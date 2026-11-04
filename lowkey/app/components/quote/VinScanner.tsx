"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/b-button";
import { Typography } from "@/components/ui/typography";
import { decodeVinFrame, vinFromBarcodeText } from "@/lib/quote/barcode";

const HINT_AFTER_MS = 20_000;
const FRAME_MS = 250;
const MAX_WIDTH = 1280;

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue?: string }[]> };
type DetectorCtor = new (o: { formats: string[] }) => Detector;

/**
 * A live camera view that looks for a VIN barcode (task 059). Frames are
 * decoded on the device (the browser's own detector when it has one,
 * else the bundled reader) and are never sent anywhere. The first VIN
 * whose check digit holds ends the scan; the camera is stopped on every
 * exit.
 */
export function VinScanner({
  onVin,
  onUnavailable,
  onCancel,
}: {
  onVin: (vin: string) => void;
  onUnavailable: () => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hint, setHint] = useState(false);
  const cb = useRef({ onVin, onUnavailable });
  cb.current = { onVin, onUnavailable };

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hintTimer = setTimeout(() => setHint(true), HINT_AFTER_MS);
    const canvas = document.createElement("canvas");
    const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    let native: Detector | null = null;
    try {
      native = Native ? new Native({ formats: ["code_39", "code_128", "data_matrix", "qr_code"] }) : null;
    } catch {
      native = null;
    }

    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(hintTimer);
      stream?.getTracks().forEach((t) => t.stop());
    };

    const tick = async () => {
      const video = videoRef.current;
      if (stopped || !video || video.readyState < 2 || !video.videoWidth) {
        if (!stopped) timer = setTimeout(tick, FRAME_MS);
        return;
      }
      const scale = Math.min(1, MAX_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      let vin: string | null = null;
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          if (native) {
            for (const r of await native.detect(canvas)) {
              vin = vinFromBarcodeText(r.rawValue ?? "");
              if (vin) break;
            }
          }
          if (!vin) vin = await decodeVinFrame(ctx.getImageData(0, 0, canvas.width, canvas.height));
        } catch {
          vin = null;
        }
      }
      if (stopped) return;
      if (vin) {
        stop();
        cb.current.onVin(vin);
        return;
      }
      timer = setTimeout(tick, FRAME_MS);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        timer = setTimeout(tick, FRAME_MS);
      } catch {
        if (!stopped) cb.current.onUnavailable();
      }
    })();

    return stop;
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} playsInline muted className="aspect-[4/3] w-full object-cover" aria-label="Camera view" />
        <div className="pointer-events-none absolute inset-x-6 top-1/2 h-16 -translate-y-1/2 rounded-md border-2 border-white/80" aria-hidden="true" />
      </div>
      <Typography variant="paragraph-sm" aria-live="polite">
        {hint
          ? "Can't find the barcode. It's on the windshield corner or the driver's door jamb."
          : "Hold the VIN barcode inside the frame."}
      </Typography>
      <Button type="button" variant="outline" className="min-h-11 self-start" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
