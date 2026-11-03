# Report 025: Low Key: scaffold the chat app in lowkey/app (deployable to Vercel, stub tools)
Status: in_progress
Branch head at start: a583cbce283369b7a71d878cbcc60b8249ee4102  ·  at finish: (pending)

## Summary
In progress. Scaffolding the minimal Next.js chat app in `lowkey/app` on branch `low-key`.

## Work done
- Claimed (commit `Start task 025`): set `ops/tasks/025-lowkey-app-scaffold.md` to `in_progress` and created this report. Stayed on `low-key` (did not follow the inbox skill's `git checkout main` step), per this task's "Branch: `low-key` only" and the session instruction to work only on `low-key` — the same approved deviation as tasks 022–024.
- Scaffold (this commit): created `lowkey/app` (Next.js App Router chat, one `/api/chat` route with `maxDuration = 60`, stub tools `rank_category` / `ownership_math` / `local_units`, mobile-first card UI with SAMPLE DATA tags). `ownership_math` runs the real deterministic maths in `lowkey/app/lib/ownership.ts`; fixtures in `lowkey/app/lib/fixtures.ts` echo the task-023/024 lineups. Verified before this push per `lowkey/docs/deploy.md`: `npm ci && npm run build` passes and `npm test` passes (13 tests).

## Results
- Template (P14): the official `vercel/chatbot` template (v3.1.0; Next.js + AI SDK) was rejected because it requires Neon Postgres, Vercel Blob, Auth.js and Redis — the task forbids a template that needs Postgres, auth or paid services. Chosen instead: the smallest no-database, no-auth pattern — a minimal `create-next-app`-style App Router project following the Vercel AI SDK Next.js chat pattern (`useChat` + `streamText` + `tool`), with `@ai-sdk/openai-compatible` pointed at `https://api.meta.ai/v1`. Licences: AI SDK Apache-2.0, Next.js MIT, React MIT, Zod MIT, IBM Plex fonts OFL-1.1 (Fontsource). Pinned in `lowkey/app/package.json` exactly as `lowkey/app/package-lock.json` resolves them: `next 16.4.4`, `ai 7.0.162`, `@ai-sdk/react 4.0.166`, `@ai-sdk/openai-compatible 3.0.84`, `react/react-dom 19.3.1`, `zod 4.6.7`. No database, no auth, no analytics.
- Build: `npm ci && npm run build` succeeds (routes `/` static, `/api/chat` dynamic). App tests: 13 passed (`lowkey/app/lib/ownership.test.ts`: known amortisation values, balance schedule, walk-away = depreciation + interest, month-0 lot loss, above-water month).

## Deviations
- Inbox sync step not followed (see above); synced `origin/low-key` instead.

## Blocked / questions
None yet.
