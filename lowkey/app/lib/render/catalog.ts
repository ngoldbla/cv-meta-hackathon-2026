import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react";
import { z } from "zod";

/**
 * Low Key catalog (task 034). The vocabulary the chat page can draw:
 * every component is built on the installed Iconiq components and
 * theme tokens, and every spec is built by server code from tool
 * results (see specs.ts) — the model never writes a spec or a number.
 * Dollar amounts are whole dollars (documented rounding: nearest
 * dollar, see guard.ts).
 */

const segmentSchema = z.object({
  part: z.enum(["loan", "gas", "valueLost", "interest"]),
  usd: z.number(),
});

const curvePointSchema = z.object({
  month: z.number(),
  resale: z.number(),
  balance: z.number(),
});

const dealerUnitSchema = z.object({
  title: z.string(),
  miles: z.number(),
  price: z.number(),
  dealer: z.string(),
  url: z.string(),
  note: z.string().nullable(),
});

export const catalog = defineCatalog(schema, {
  components: {
    CostCompare: {
      props: z.object({
        category: z.string(),
        rows: z.array(
          z.object({
            label: z.string(),
            valueLost: z.number(),
            interest: z.number(),
            gas: z.number(),
            total: z.number(),
            highlighted: z.boolean(),
            cheapest: z.boolean(),
          }),
        ),
      }),
      description:
        "One horizontal segmented bar per pick (value lost, interest, gas) on a shared scale, ordered cheapest to own first, with the monthly real-cost total at the right. The first ranked pick's row is highlighted (bold); every row at the lowest total is flagged cheapest and gets a 'cheapest to own' badge. Placed before the pick cards, one per turn.",
    },
    CostBars: {
      props: z.object({
        pay: z.array(segmentSchema),
        real: z.array(segmentSchema),
        payTotal: z.number(),
        realTotal: z.number(),
        backWhenSold: z.number(),
      }),
      description:
        "Two bars on one scale (the bills total): 'You pay each month' (loan + gas) and 'What it really costs you' (value lost + interest + gas); the remainder of the second bar is the hatched 'back to you' segment, backWhenSold = bills - real cost.",
    },
    LifespanTrack: {
      props: z.object({
        years: z.number().nullable(),
        loanYears: z.number(),
        miles: z.number().nullable(),
        source: z.string().nullable(),
      }),
      description:
        "A 0-20 year track (widened past 20 when needed), dark for the loan years and gold after, with a marker at the expected lifespan. Null years renders the unrated state: an empty track and 'Lifespan: not yet rated'.",
    },
    UnderwaterMini: {
      props: z.object({
        evenMonth: z.number().nullable(),
        curve: z.array(curvePointSchema),
      }),
      description:
        "The task-026 worth-vs-owe mini chart, wrapped: 61-point resale/balance curve from ownership_math with the even (above-water) month.",
    },
    DealerLine: {
      props: z.object({
        face: dealerUnitSchema.nullable(),
        more: z.array(dealerUnitSchema),
        error: z.string().nullable(),
      }),
      description:
        "The cheapest local unit on the card face plus the remaining units behind an 'N more nearby' collapsible (task 033), each with its leftover-year note.",
    },
    PickCard: {
      props: z.object({
        rank: z.number().nullable(),
        badgeLabel: z.string(),
        modelLabel: z.string(),
        sentence: z.string(),
        trimLine: z.string().nullable(),
        inStock: z.boolean(),
        category: z.string(),
        modelKey: z.string(),
        hasWalkAway: z.boolean(),
        lifespanSource: z.string().nullable(),
        lifespanAsOf: z.string().nullable(),
      }),
      slots: ["default"],
      description:
        "Container for one pick: badge, in-stock dot, Hairline figure, model and trim, code-written sentence, trim-step line, then its children in mockup order (CostBars, LifespanTrack, UnderwaterMini, DealerLine), then 'If I change my mind'.",
    },
  },
  actions: {},
});

export type LowkeyCatalog = typeof catalog;
