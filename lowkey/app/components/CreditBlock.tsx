"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/b-accordion";

/**
 * "A low-key way to buy a car." (task 038, part 5): the one compact
 * credit block on the opening. Shown in full on a first visit; once
 * the visitor has run a search it collapses to the single "How Low
 * Key works" line. The searched flag lives in localStorage.
 */
export const CREDIT_POINTS: { lead: string; text: string }[] = [
  {
    lead: "Calm by design.",
    text: "We can't fix the dealership. We can make the decision simple: a few good choices, side by side.",
  },
  {
    lead: "Less risk.",
    text: "Every car here is among the best at holding its value in its class, and every price includes the loan, gas and tax.",
  },
  {
    lead: "Shop anonymously.",
    text: "No account, no phone number. Dealers don't know you're looking until you contact them.",
  },
  {
    lead: "Lowest listed prices.",
    text: "We show the cheapest listing we find near you, and how many others there are.",
  },
  {
    lead: "Details later.",
    text: "No photos, colours or sales gimmicks until you're ready. Good car buying starts with a little distance.",
  },
];

export function CreditBlock({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold">A low-key way to buy a car.</p>
      <Accordion
        variant="quiet"
        value={open ? ["how"] : []}
        onValueChange={(next) => onOpenChange(next.includes("how"))}
        className="mt-1"
      >
        <AccordionItem value="how">
          <AccordionTrigger className="min-h-11 text-sm">
            How Low Key works
          </AccordionTrigger>
          <AccordionContent>
            <ol className="flex list-none flex-col gap-2 pb-1 text-sm leading-relaxed">
              {CREDIT_POINTS.map((point) => (
                <li key={point.lead}>
                  <strong className="font-semibold">{point.lead}</strong>{" "}
                  <span className="text-foreground/80">{point.text}</span>
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
