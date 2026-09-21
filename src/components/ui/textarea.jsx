import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, style, ...props }, ref) => {
  return (
    <textarea
      style={{ color: '#fafaf9', caretColor: '#fcfc03', ...style }}
      className={cn(
        "flex min-h-[96px] w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 shadow-sm backdrop-blur-xl transition-all focus-visible:border-[#fcfc03] focus-visible:ring-2 focus-visible:ring-[#fcfc03]/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
