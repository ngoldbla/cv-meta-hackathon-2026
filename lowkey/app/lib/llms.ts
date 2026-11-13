/**
 * The text of /llms.txt and /llms-full.txt (task 060). Written from
 * lowkey/docs/why-low-key.md, lowkey/docs/decision-model.md and /about.
 * No figures (no digits outside URLs) and no listings provider name: the
 * sources are on /about.
 */
import { ANSWERS } from "./answers";
import { BRAND } from "./brand";

const u = (path: string) => `${BRAND.url}${path}`;

export const LLMS_TXT = `# ${BRAND.name} (${BRAND.domain})

> ${BRAND.slogan} ${BRAND.identity} A calm way to buy a car: the new cars that hold their value near you, what each really costs a month, and what changing your mind would cost. No ads, no sign-up, no money from dealers.

Every figure on the site is computed by code and never written by a language model.

## Pages
- [Start](${u("/")}): choose your area and a type of car.
- [Sedans that hold their value](${u("/sedan")}): one of five type pages (sedan, suv, pickup, minivan, hybrid).
- [How to buy a car online in the United States](${u("/buy-a-car-online")}): plain answers to what shoppers ask: where to buy, which cars hold their value, what a car costs a month.
- [About](${u("/about")}): who runs Low Key, how it works, how AI is used, and where the data comes from.
- [Contact](${u("/contact")}): how to reach us.
- [Privacy](${u("/privacy")}): what is kept and what is sent, and to whom.
- [Got the VIN?](${u("/quote")}): check a dealer quote or window sticker against the numbers.

## Full text
- [How Low Key works, in plain language](${u("/llms-full.txt")})
`;

export const LLMS_FULL_TXT = `# ${BRAND.name} (${BRAND.domain})

${BRAND.slogan}

${BRAND.identity}

Low Key is a calm way to buy a car. It does not try to fix the dealership. It makes the decision simple: a few good choices, side by side. There is no account, no phone number, no advertising, and no money from dealers. Dealers do not know you are looking until you contact them.

## How the monthly cost is worked out
You choose a type of car and your area, and you may set your own down payment, loan term and interest rate. For each car, Low Key finds the lowest listed price near you and works out what the car really costs a month. That cost has parts: the loan payment, the interest you pay on top of the price, the fuel the car uses, sales tax, and the value the car loses while you own it. When you do not give a rate, Low Key uses the current average new-car loan rate published by the Federal Reserve. Fuel uses the car's official fuel economy and a gas-price outlook. All of this arithmetic is done by ordinary code from data, and every figure shown is checked by a guard against the data that produced it.

## The cost of leaving
Low Key also shows what it would cost to change your mind. It follows what you owe on the loan against what the car would sell for as it ages, and shows when you would first owe less than the car is worth, and what you would get back if you sold.

## The resale view
Each car in the lineup is among the best in its class at holding its value. That comes from a table built from real sold-vehicle history: how much of its new price each model keeps as it ages. Low Key shows where the lowest nearby price sits among the other prices listed near you and across the country.

## How AI is used
Low Key was built with coding agents through a task mailbox kept in its public repository. At runtime, an open-weights vision model reads a photo of a dealer sheet or window sticker when you use the quote check. It copies the page and pairs each label with its value. Plain code then finds the VIN, checks it, and picks out every number, and you confirm each one before anything is compared. There is no chat. A language model never writes a figure, and the interface is built from a fixed set of components. A separate forecasting model projects weekly gas prices ahead for the fuel part of the cost.

## What Low Key does not do
No ads. No sign-up. Not paid by dealers. No photos, colours or sales gimmicks until you are ready: each car is drawn as a simple line figure of its type, so the choice stays about value, cost and the car's life.

## Where the data comes from
The sources, credits and licences are listed on the About page: ${u("/about")}. The code is public at ${BRAND.repoUrl}.

## Common questions
${ANSWERS.map((x) => `### ${x.q}\n${x.a.join(" ")}`).join("\n\n")}

## Pages
- ${u("/")}
- ${u("/buy-a-car-online")}
- ${u("/about")}
- ${u("/contact")}
- ${u("/privacy")}
- ${u("/quote")}
`;

export const textHeaders = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
} as const;
