---
id: "057"
title: "Low Key: VIN-first quote check"
status: in-progress
created: 2026-11-04
report: ops/reports/057-lowkey-vin-first-quote.md
---
# Low Key: VIN-first quote check

**Branch: `task/057-vin-first-quote` cut from `main`, with a PR into `main`.** The rules of task 055 apply. Provider cap: $0.25 for checks plus $1 for the mileage-weight fit; the table is rebuilt from cache.

Design: `lowkey/docs/specs/2026-11-04-vin-first-quote-design.md`. Plan: `lowkey/docs/plans/2026-11-04-vin-first-quote.md`.

## Why (Dylan, 2026-11-04)
A much simpler way to digest cars for comparison: take the VIN, load the car from the API, and read only the financial terms (price, down, APR, term) and the mileage from the photo.
