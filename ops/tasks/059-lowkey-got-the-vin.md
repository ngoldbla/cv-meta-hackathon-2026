---
id: "059"
title: "Low Key: Got the VIN?"
status: done
created: 2026-11-04
report: ops/reports/059-lowkey-got-the-vin.md
---
# Low Key: Got the VIN?

**Branch: `task/059-got-the-vin` cut from `main`, with a PR into `main`.** The rules of task 055 apply.

Design: `lowkey/docs/specs/2026-11-04-got-the-vin-design.md`. Plan: `lowkey/docs/plans/2026-11-04-got-the-vin.md`.

## Why (Dylan, 2026-11-04)
"Check a quote" confuses people, and the photo VIN path is hidden inside the quote form. The entry becomes "Got the VIN?": VIN first (live scanner, photo or PDF, or typed), the VIN fills in the car, the shopper adds the deal they were offered, and the confirmed deal is saved on the device as "Your deal", a benchmark on results and car pages that can be shared as a link.

## Done when
- The spec's flow, saved deals, benchmark row, car-page line and share link work as designed.
- All gates pass; Playwright at 390 px light and dark; detect 0 findings at 390 and 1280.
- Report in `ops/reports/059-lowkey-got-the-vin.md`; PR into `main` with the preview URL; production verified after merge.
