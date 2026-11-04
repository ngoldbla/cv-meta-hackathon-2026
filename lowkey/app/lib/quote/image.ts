/**
 * Turn whatever the shopper picked (a camera shot, a photo from the
 * library, a screenshot, or a PDF from email) into one JPEG for the
 * reader (task 051). Runs in the browser only: the file never leaves
 * the device except as this resized image.
 *
 * - Images are scaled so the long side is at most 1600 px.
 * - A PDF's first page is rendered with pdf.js at the same size.
 */

export const MAX_SIDE = 1600;

export class UnreadableFileError extends Error {}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function canvasToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "";
}

/** Scale factor so the long side fits MAX_SIDE (never enlarges). */
export function fitScale(width: number, height: number, maxSide = MAX_SIDE): number {
  const long = Math.max(width, height);
  return long > 0 ? Math.min(1, maxSide / long) : 1;
}

async function imageToBase64(file: File): Promise<string> {
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Some browsers can't decode every format (for example HEIC on desktop).
    const url = URL.createObjectURL(file);
    try {
      bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new UnreadableFileError("unreadable image"));
        el.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const w = "naturalWidth" in bitmap ? bitmap.naturalWidth : bitmap.width;
  const h = "naturalHeight" in bitmap ? bitmap.naturalHeight : bitmap.height;
  const scale = fitScale(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UnreadableFileError("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvasToBase64(canvas);
}

async function pdfToBase64(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  try {
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    // Render at up to MAX_SIDE, allowing up to 3x for small page sizes.
    const scale = Math.min(3, MAX_SIDE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new UnreadableFileError("no canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    await task.destroy();
    return canvasToBase64(canvas);
  } catch (e) {
    if (e instanceof UnreadableFileError) throw e;
    throw new UnreadableFileError("unreadable pdf");
  }
}

/** A picked file as a JPEG, base64-encoded, ready for /api/quote/read. */
export async function fileToJpegBase64(file: File): Promise<string> {
  if (isPdf(file)) return pdfToBase64(file);
  if (file.type && !file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
    throw new UnreadableFileError("not an image");
  }
  return imageToBase64(file);
}
