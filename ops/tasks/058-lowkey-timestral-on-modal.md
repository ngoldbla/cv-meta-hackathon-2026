---
id: "058"
title: "Low Key: Timestral on Modal"
status: in progress
created: 2026-11-04
report: ops/reports/058-lowkey-timestral-on-modal.md
---
# Low Key: Timestral on Modal

**Branch: `task/058-timestral-on-modal` cut from `main`, with a PR into `main`.** The rules of task 055 apply.

Design: `lowkey/docs/specs/2026-11-04-timestral-on-modal-design.md`. Plan: `lowkey/docs/plans/2026-11-04-timestral-on-modal.md`.

## Why (Dylan, 2026-11-04)
Timestral should run as a serverless GPU endpoint, prestaged on Modal Volumes, used only when needed: weekly on a Modal schedule independent of dylan-pc, and on demand when the app's forecast is older than the latest EIA week. It is part of the story.
