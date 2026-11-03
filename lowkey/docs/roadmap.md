# Low Key: roadmap after the hackathon

*Agreed direction (Dylan, 2026-11-03). None of this is built yet. Each item starts with a preflight check of the data before anything ships.*

## Used cars, 1–5 years old
- **Which cars:**
  - model years 1–5 old;
  - mileage up to about 15,000 a year of age;
  - a clean title (no salvage, rebuilt, flood or lemon brand);
  - no severe accident;
  - what the listing data can't verify (smoking, the full history) is labelled "not checked by Low Key: ask the dealer" and goes into the deal sheet's questions.
- **History and safety:**
  - the dealer's Carfax or AutoCheck link when the listing has one;
  - NHTSA open recalls by VIN (free);
  - a link to an NMVTIS title check.
- **Value:** a depreciation model over **age and mileage**: the existing age curve plus a mileage adjustment around the typical miles for that age, partly pooled within each category. It is fitted on sold prices and ships only if it beats age-only on held-out sales. It gives:
  - a fair-price signal ("$1,200 below typical for its age and miles");
  - resale at the end of the hold (age plus the owner's 12,000 miles a year);
  - "about N years left".
- **Loan rate:** a published used-car average, with its source and date.
- **Shopping both ways:**
  - a New | Used toggle;
  - on each card, "What about used?" or "What about new?" with the real monthly cost difference.
- **Open questions:** minor accidents; one-owner and certified pre-owned as labels or filters; the mileage cap.
- **Preflight (P21):**
  - the used and certified listing fields;
  - sold data at ages 1–10, by mileage;
  - the used loan-rate source.

## Insurance, maintenance and repairs (total cost to own)
- **Insurance (est.):**
  - the state's average full-coverage premium (NAIC), adjusted for inflation;
  - × a dampened model factor from HLDI insurance-loss data by make and model;
  - an optional "Driver under 25?" choice (never sex), stored only on the device;
  - shown as a range, with a switch to leave it out.
- **Maintenance and repairs (est.):**
  - scheduled maintenance, tires and brakes;
  - repairs near zero under the factory warranty, then rising by age and the model's reliability.
  This matters most for used cars.
- **Open questions:** whether insurance is in the total by default; the under-25 option.
- **Preflight (P22):** the terms and coverage of NAIC, HLDI and the maintenance-cost sources.

## Popularity, calmly
- "Chosen by N Low Key shoppers this week" per model, counted when someone opens a listing or copies a deal sheet.
- Shown only at 10 or more. Never "viewing now".
- No IP address or ZIP is stored; a random ID stays on the device only; counts are deleted after 8 days.
- Upstash Redis on Vercel.

## More from the open-source bundle
Forks for luxury cars, motorcycles or other countries, through `lowkey/docs/roll-your-own.md` and the provider adapter (task 044).
