# Report 051: upload a photo, screenshot or PDF
Status: done

## Summary
Check a quote now offers "Choose a photo or PDF" and "Take a photo". A PDF's first page is rendered in the browser with pdf.js; a picked image is resized to 1600 px. While reading, the drawer shows the seconds elapsed and what to expect. The reader now transcribes only lines that matter, which cut a long window-sticker read from about 55 s to about 22 s warm with no loss in accuracy. One repeat read of a real worksheet once came back empty after that change; the schema now requires a non-empty transcript and pairs, a thin read retries with the full prompt, and on the fixed version five repeat reads of the same document were all complete.

## Work done
- `lowkey/app/lib/quote/image.ts` (`fileToJpegBase64`, `fitScale`, PDF via `pdfjs-dist` 6.5.438, Apache-2.0), `image.test.ts`.
- `components/QuoteCheck.tsx`: two inputs (library/PDF without `capture`, camera with it), drag and drop, elapsed time, `unsupported` state, new subtitle.
- `cloud/quote_reader/schema.py` + `serve.py`: shorter transcript instruction; `min_length=1` on transcript and pairs (grammar-enforced); retry with `FULL_PROMPT` when fewer than 3 lines or no pairs.
- `cloud/quote_reader/redeploy.sh`: deploy, then retire containers still running the previous version.
- `cloud/quote_reader/snap_probe.py`: a separate app to test GPU memory snapshots (not yet measured; its first deploy failed on an import, fixed).

## Time to first response (measured 2026-11-04, from upload to fields on screen)
| Case | Time |
|---|---|
| Cold start (no container running) | 85–94 s |
| Warm, real dealer worksheet | 17.5–18.6 s |
| Warm, real window sticker (before the shorter transcript) | 53–56 s |
| Warm, real window sticker (after) | 21.5–23.8 s |
| Warm, invented fixtures (12) | 7–19 s each |
| PDF through the browser (fixture, warm) | 19 s |

Add about 1–3 s for the upload on a phone connection. The drawer starts the reader when it opens, so the time someone spends finding the photo overlaps the cold start.

## Results
- Regression: the 12 fixtures still 12/12 on every field after both reader changes.
- Real worksheet, on the fixed version: complete (31 lines, price, three fees, amount financed, six grid cells) on repeat reads.
- `npm run build`, 227 app tests, `pytest -q` (79), name_guard, secret_guard. Local headless Chrome: PDF upload through the library input read end to end; screenshots in `~/.cache/low-key/screens/051/`.

## Deviations / lessons
- **Old containers keep serving after a deploy.** Repeat reads right after a deploy went to a warm container still running the pre-fix code (empty transcripts that the new schema forbids). `redeploy.sh` now retires old containers after each deploy.
- HEIC files from a desktop browser may not decode; phones convert library photos to JPEG on upload. The drawer says to try a screenshot or JPEG when a file can't be opened.
