import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring/60",
  {
    variants: {
      variant: {
        default:
          "border-primary/40 bg-primary/25 text-emerald-950 shadow-[0_0_24px_hsla(var(--glow-primary),0.28)] hover:bg-primary/35",
        secondary:
          "border-emerald-950/10 bg-white/55 text-secondary-foreground hover:bg-white/75",
        destructive:
          "border-destructive/30 bg-destructive/15 text-destructive-foreground shadow hover:bg-destructive/20",
        outline: "border-emerald-950/10 bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
