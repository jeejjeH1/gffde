"use client";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";
import { Info } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-1 rounded-md border text-xs font-medium transition-colors disabled:opacity-40 focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent",
  {
    variants: {
      variant: {
        default: "border-line bg-panel2 hover:bg-line px-3 py-1.5",
        primary: "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 px-3 py-1.5",
        ghost: "border-transparent hover:bg-panel2 px-2 py-1",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>>(
  ({ className, variant, ...p }, ref) => <button ref={ref} className={cn(button({ variant }), className)} {...p} />,
);
Button.displayName = "Button";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn("h-8 w-full rounded-md border border-line bg-panel px-2 text-xs num outline-none focus:border-accent", className)} {...p} />
));
Input.displayName = "Input";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-line bg-panel", className)} {...p} />;
}

export function Badge({ tone = "muted", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "up" | "down" | "warn" | "muted" | "accent" }) {
  const tones = { up: "text-up border-up/30 bg-up/10", down: "text-down border-down/30 bg-down/10", warn: "text-warn border-warn/30 bg-warn/10", muted: "text-muted border-line", accent: "text-accent border-accent/30 bg-accent/10" };
  return <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", tones[tone], className)} {...p} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-panel2", className)} />;
}

export const TooltipProvider = Tooltip.Provider;

export function Tip({ children, text }: { children: React.ReactNode; text: React.ReactNode }) {
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild><span className="cursor-help">{children}</span></Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="top" sideOffset={6} className="z-50 max-w-xs rounded-md border border-line bg-panel2 px-3 py-2 text-xs leading-relaxed text-text shadow-xl">
          {text}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export const GLOSSARY: Record<string, string> = {
  funding: "Periodic payment between longs and shorts of a perpetual swap that anchors its price to the index. Positive rate: longs pay shorts. Negative: shorts pay longs.",
  spread: "Difference between the two exchanges' funding rates, normalized to an 8-hour basis so different intervals are comparable. It is NOT a profit figure: legs settle at different times and rates change.",
  gross: "Sum of hypothetical funding payments received minus paid by both legs over the horizon, before any costs.",
  fees: "Entry + exit taker fees on both legs, using the fee rates you configure. Real fees depend on your tier and order type.",
  slippage: "Estimated cost of crossing the order book when opening/closing. Only computed where order-book depth is available.",
  net: "Gross funding − fees − slippage − other costs. A hypothetical estimate assuming currently indicated rates persist; it can be negative.",
  interval: "Time between funding settlements on that exchange (commonly 8h; some symbols 4h/1h). Positions only accrue funding if held at settlement.",
  basis: "Price difference between the same asset on the two venues. Can move against you and is not captured by funding estimates.",
  freshness: "Age of the data since our last successful fetch. Stale data is flagged and should not be relied on.",
  volume: "24h turnover in quote currency (the lower of both exchanges). A weak proxy for liquidity — check order-book depth before sizing.",
};

export function Term({ k, children }: { k: keyof typeof GLOSSARY; children: React.ReactNode }) {
  return (
    <Tip text={GLOSSARY[k]}>
      <span className="inline-flex items-center gap-1 border-b border-dotted border-muted/60">{children}<Info className="h-3 w-3 text-muted" /></span>
    </Tip>
  );
}
