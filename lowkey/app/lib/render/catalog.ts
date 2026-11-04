import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react";
import { z } from "zod";

/**
 * Low Key catalog (task 034). The vocabulary the screens can draw:
 * every component is built on the installed Iconiq components and
 * theme tokens, and every spec is built by server code from tool
 * results (see specs.ts) — the model never writes a spec or a number.
 * Dollar amounts are whole dollars (documented rounding: nearest
 * dollar, see guard.ts).
 */

const segmentSchema = z.object({
  part: z.enum(["loan", "gas", "valueLost", "interest", "tax"]),
  usd: z.number(),
});

const curvePointSchema = z.object({
  month: z.number(),
  resale: z.number(),
  balance: z.number(),
  equity: z.number(),
});

const dealerUnitSchema = z.object({
  title: z.string(),
  miles: z.number(),
  price: z.number(),
  dealer: z.string(),
  url: z.string(),
  note: z.string().nullable(),
  /** Task 054: the unit the shopper is going for. */
  chosen: z.boolean().optional(),
  vin: z.string().nullable().optional(),
});

export const catalog = defineCatalog(schema, {
  components: {
    CostCompare: {
      props: z.object({
        category: z.string(),
        rows: z.array(
          z.object({
            label: z.string(),
            model: z.string(),
            trim: z.string().nullable(),
            labels: z.array(z.string()),
            valueLost: z.number(),
            interest: z.number(),
            gas: z.number(),
            tax: z.number(),
            total: z.number(),
            bills: z.number(),
            nearestMiles: z.number().nullable(),
            lifespanYears: z.number().nullable(),
            price: z.number().nullable(),
            listingTotal: z.number().nullable(),
            vsLocalMedian: z.number().nullable().optional(),
            chosen: z.boolean().optional(),
          }),
        ),
      }),
      description:
        "The chooser (task 040): one row per car with its best-at labels, a segmented real-cost bar (value lost, interest, gas, sales tax) on a shared scale and the monthly real-cost total, the monthly bills, the nearest unit and the lifespan. A 'Sort by' control (Real cost, Monthly, Nearest, Lasts longest) re-orders the rows; the spec arrives in Real cost order. No rank numbers. Tapping a row opens that car's full card in a sheet. One per turn.",
    },
    CostBars: {
      props: z.object({
        pay: z.array(segmentSchema),
        real: z.array(segmentSchema),
        payTotal: z.number(),
        realTotal: z.number(),
        backWhenSold: z.number(),
        gasMpg: z.number().nullable().optional(),
        gasMpgTypical: z.boolean().optional(),
      }),
      description:
        "Two bars on one scale (the bills total): 'You pay each month' (loan + gas) and 'What it really costs you' (value lost + interest + gas + sales tax); the remainder of the second bar is the hatched 'back to you' segment, backWhenSold = bills - real cost. gasMpg is the EPA combined MPG the gas estimate used (task 042), gasMpgTypical true when it is the model's typical figure rather than the local unit's match.",
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
    EquityMini: {
      props: z.object({
        positiveEquityMonth: z.number().nullable(),
        curve: z.array(curvePointSchema),
      }),
      description:
        "Single-line equity mini chart (task 039): 61-point equity curve (resale, balance, equity) from ownership_math with the positive-equity month; green fill above zero, muted band below.",
    },
    DealerLine: {
      props: z.object({
        face: dealerUnitSchema.nullable(),
        more: z.array(dealerUnitSchema),
        error: z.string().nullable(),
        listingTotal: z.number().nullable(),
        listingRadius: z.number().nullable(),
        listingMax: z.number().nullable(),
      }),
      description:
        "The cheapest local unit on the card face plus the remaining units behind an 'N more nearby' collapsible (task 033), each with its leftover-year note.",
    },
    PickCard: {
      props: z.object({
        labels: z.array(z.string()),
        modelLabel: z.string(),
        sentence: z.string(),
        trimLine: z.string().nullable(),
        inStock: z.boolean(),
        category: z.string(),
        modelKey: z.string(),
        hasWalkAway: z.boolean(),
        chosenNote: z.string().nullable().optional(),
      }),
      slots: ["default"],
      description:
        "Container for one car: best-at labels (no rank), in-stock dot, Hairline figure, model and trim, code-written sentence, trim-step line, then its children in mockup order (CostBars, LifespanTrack, EquityMini, DealerLine), then 'If I change my mind'.",
    },
    PriceStrip: {
      props: z.object({
        modelKey: z.string(),
        title: z.string(),
        year: z.number().nullable(),
        unitYear: z.number().nullable(),
        sameYear: z.boolean(),
        radius: z.number(),
        localLoaded: z.boolean(),
        nationalLoaded: z.boolean(),
        localCount: z.number().nullable(),
        low: z.number().nullable(),
        p25: z.number().nullable(),
        localMedian: z.number().nullable(),
        p75: z.number().nullable(),
        high: z.number().nullable(),
        nationalMedian: z.number().nullable(),
        nationalCount: z.number().nullable(),
        msrp: z.number().nullable(),
        msrpOwn: z.boolean(),
        listed: z.number().nullable(),
        vsLocalMedian: z.number().nullable(),
        vsNationalMedian: z.number().nullable(),
        vsMsrp: z.number().nullable(),
        positionSide: z.enum(["lower", "higher", "at"]).nullable(),
        positionShare: z.number().nullable(),
      }),
      description:
        "Price in context (task 054): listed prices of this model, trim and year. A track from the local p5 to p95 with the p25-p75 band, ticks for the local median, the national median and the MSRP, and the marked unit; then one plain sentence written in code from these props.",
    },
    ListingDetail: {
      props: z.object({
        modelKey: z.string(),
        title: z.string(),
        vin: z.string().nullable(),
        dealer: z.string(),
        miles: z.number(),
        daysOnLot: z.number().nullable(),
        price: z.number(),
        tax: z.number().nullable(),
        outTheDoor: z.number().nullable(),
        taxNotice: z.string().nullable(),
        down: z.number(),
        downShare: z.number().nullable(),
        aprPercent: z.number(),
        termMonths: z.number(),
        loan: z.number(),
        gas: z.number().nullable(),
        bills: z.number(),
        positiveEquityMonth: z.number().nullable(),
        url: z.string(),
      }),
      description:
        "The listing sheet (task 041): one local unit before the dealer's site. Year, make, model and trim; price with fees; days on the lot; dealer name and distance; the estimated out-the-door price (price with fees + estimated sales tax); this unit's monthly bills (loan + gas) and positive-equity month at the turn's assumptions. 'Take this to the dealer' writes a short deal sheet to copy or share; 'Open dealer's listing' is the last action, in a new tab.",
    },
  },
  actions: {},
});

export type LowkeyCatalog = typeof catalog;
