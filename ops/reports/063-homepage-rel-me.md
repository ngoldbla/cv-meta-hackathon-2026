# 063 homepage rel=me

## Done
- Added `<link rel="me" href="https://square.pov.town/s/j2bxjk" />` to the homepage (`lowkey/app/app/page.tsx`). React 19 hoists it into `<head>`; only `/` carries it.

## Checked
- `npm run build` in `lowkey/app` compiles; the served `/` has the link in `<head>`.
- `scripts/secret_guard.py --all` is clean.

## Open
- `npm test`, `pytest -q` and `name_guard.py` were not run to completion.
