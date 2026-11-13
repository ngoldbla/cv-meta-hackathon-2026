/**
 * The answer page (/buy-a-car-online): plain answers to the questions
 * shoppers ask search engines and AI assistants. Each answer opens with
 * the direct answer, so a tool that quotes one paragraph quotes the right
 * one. Every claim matches /about, lowkey/docs/why-low-key.md or the code;
 * no figures (numbers on this site come from code) and no listings
 * provider name.
 */
import { BRAND } from "./brand";

export type Answer = {
  /** The question as a shopper would type it. */
  q: string;
  /** Paragraphs; the first is the direct answer. */
  a: string[];
  /** Optional links shown under the answer: [label, path]. */
  links?: [string, string][];
};

export const ANSWER_PAGE = {
  path: "/buy-a-car-online",
  title: "How to buy a car online in the United States",
  description:
    "Where to buy a car online in the US, which new cars hold their value, and what a car really costs a month. Plain answers from Low Key, a free car-buying guide with no ads.",
  lead: `You can shop for a new car online anywhere in the United States, but the sale itself is almost always made by a dealer. ${BRAND.identity} Choose a type of car and your ZIP code, and Low Key shows the new cars near you that hold their value best, what each really costs a month, and the lowest listed prices nearby. Then you contact the dealer that has the car.`,
} as const;

export const ANSWERS: Answer[] = [
  {
    q: "Where can I buy a car online in the United States?",
    a: [
      "New cars in the United States are sold through dealers, so even when you shop online, you usually complete the purchase with a dealer. The useful part to do online is choosing the car and knowing a fair price before you talk to anyone.",
      "Low Key does that part. It is a free website, not a dealer or a marketplace: it does not sell cars, take a fee or pass your details to anyone. It shows the lowest listed prices near you, and when you are ready you contact the dealer listing the car yourself.",
    ],
    links: [["Start with your ZIP code", "/"]],
  },
  {
    q: "Is there a car-buying site with no ads?",
    a: [
      "Yes. Low Key has no ads, no sign-up and no account, and takes no money from dealers. Dealers do not know you are looking until you contact them.",
      "It also leaves out photos, colours and sales gimmicks: each car is drawn as a simple line figure of its type, so the choice stays about value, cost and the car's life.",
    ],
  },
  {
    q: "How do I buy a car without regret?",
    a: [
      "Know three things before you sign: that the car holds its value, what it really costs each month, and what it would cost to change your mind. Low Key shows all three for each car it suggests.",
      "What it costs to change your mind is the gap between what you would owe on the loan and what the car would sell for, as the car ages. Low Key shows when you would first owe less than the car is worth.",
    ],
  },
  {
    q: "Which new cars hold their value best?",
    a: [
      "Low Key's lineup for each type of car is drawn from the models that keep the most of their new price as they age, measured from real sold-vehicle history rather than opinion.",
      "Pick a type to see the current picks near you:",
    ],
    links: [
      ["Sedans that hold their value", "/sedan"],
      ["SUVs that hold their value", "/suv"],
      ["Pickups that hold their value", "/pickup"],
      ["Minivans that hold their value", "/minivan"],
      ["Hybrids that hold their value", "/hybrid"],
    ],
  },
  {
    q: "How do I find new cars for sale near me by ZIP code?",
    a: [
      "Enter your ZIP code on Low Key, or tap Use my location. It finds the lowest listed price for each suggested car near you, and shows where that price sits among the others listed near you and across the country.",
    ],
    links: [["Find cars near you", "/"]],
  },
  {
    q: "How much will a new car really cost me a month?",
    a: [
      "More than the loan payment. Low Key's monthly cost adds the loan payment, the interest on top of the price, the fuel the car uses, sales tax for your state, and the value the car loses while you own it.",
      "You can set your own down payment, loan term and interest rate. Without a rate, Low Key uses the current average new-car loan rate published by the Federal Reserve. Fuel uses the car's official fuel economy and a gas-price outlook. All of this is worked out by ordinary code from data; no language model writes a figure.",
    ],
  },
  {
    q: "How can I check a dealer's quote?",
    a: [
      "Use Low Key's Got the VIN? page. Scan or type the VIN, or add a photo or PDF of the dealer's sheet or the window sticker. It fills in the car from the VIN, reads the numbers off the page, and lets you confirm each one before it puts the quote next to its own picks on the same terms.",
    ],
    links: [["Check a quote", "/quote"]],
  },
  {
    q: "Who runs Low Key?",
    a: [
      `Low Key is an independent, open-source project by ${BRAND.founder.name}. Its code and data sources are public, and it is not owned by or paid by any dealer, maker or lender.`,
    ],
    links: [
      ["About Low Key", "/about"],
      ["Contact", "/contact"],
    ],
  },
];
