"use client";

import type { Spec } from "@json-render/core";
import { JSONUIProvider, Renderer, defineRegistry } from "@json-render/react";
import type { ReactNode } from "react";

import { catalog } from "@/lib/render/catalog";
import { CostBarsView } from "./CostBars";
import { CostCompareView } from "./CostCompare";
import { DealerLineView } from "./DealerLine";
import { LifespanTrackView } from "./LifespanTrack";
import { PickCardView } from "./PickCardView";
import { EquityMiniView } from "./EquityMini";
import { ChooserContext } from "./chooser-context";
import { WalkAwayContext } from "./walk-context";
import { DEFAULT_SORT, type SortKey } from "@/lib/chooser";

/**
 * Low Key registry (task 034): maps the catalog to React components
 * built on the installed Iconiq components and theme tokens.
 */
export const { registry } = defineRegistry(catalog, {
  components: {
    CostCompare: ({ props }) => (
      <CostCompareView category={props.category} rows={props.rows} />
    ),
    CostBars: ({ props }) => (
      <CostBarsView
        pay={props.pay}
        real={props.real}
        payTotal={props.payTotal}
        realTotal={props.realTotal}
        backWhenSold={props.backWhenSold}
      />
    ),
    LifespanTrack: ({ props }) => (
      <LifespanTrackView
        years={props.years}
        loanYears={props.loanYears}
        miles={props.miles}
        source={props.source}
      />
    ),
    EquityMini: ({ props }) => (
      <EquityMiniView
        positiveEquityMonth={props.positiveEquityMonth}
        curve={props.curve}
      />
    ),
    DealerLine: ({ props }) => (
      <DealerLineView
        face={props.face}
        more={props.more}
        error={props.error}
        listingTotal={props.listingTotal}
        listingRadius={props.listingRadius}
        listingMax={props.listingMax}
      />
    ),
    PickCard: ({ props, children }) => (
      <PickCardView {...props}>{children}</PickCardView>
    ),
  },
});

/** Renders one spec with the Low Key registry. Specs only; the
 *  number guard runs before this is called (see HomeClient). */
export function RenderSpec({
  spec,
  onWalkAway,
  sort = DEFAULT_SORT,
  onSort,
  onOpen,
}: {
  spec: Spec;
  onWalkAway?: (modelKey: string) => void;
  /** Chooser (task 040): the page-owned sort and row-open handler. */
  sort?: SortKey;
  onSort?: (key: SortKey) => void;
  onOpen?: (modelKey: string) => void;
}): ReactNode {
  return (
    <WalkAwayContext.Provider value={{ onWalkAway }}>
      <ChooserContext.Provider value={{ sort, onSort, onOpen }}>
        <JSONUIProvider registry={registry}>
          <Renderer spec={spec} registry={registry} />
        </JSONUIProvider>
      </ChooserContext.Provider>
    </WalkAwayContext.Provider>
  );
}
