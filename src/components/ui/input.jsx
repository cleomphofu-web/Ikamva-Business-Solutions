import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, style, ...props }, ref) => {
  return (
    <input
      type={type}
      style={{ color: '#fafaf9', caretColor: '#fcfc03', ...style }}
      className={cn(
        "flex h-11 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-base text-slate-100 placeholder:text-slate-500 shadow-sm backdrop-blur-xl transition-all focus-visible:border-[#fcfc03] focus-visible:ring-2 focus-visible:ring-[#fcfc03]/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  );
})
Input.displayName = "Input"

export { Input }
