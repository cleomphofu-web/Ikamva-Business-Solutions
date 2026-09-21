import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    (<div
      className={cn("animate-pulse rounded-2xl bg-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]", className)}
      {...props} />)
  );
}

export { Skeleton }
