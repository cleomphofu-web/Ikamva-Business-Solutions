import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

const agentSteps = [
  { text: "Understanding your request" },
  { text: "Reviewing relevant information" },
  { text: "Planning the response" },
  { text: "Generating an answer" },
  { text: "Preparing the final result" },
];

export function AgentThinkingLoader({ loading, duration = 1500, className }: { loading: boolean, duration?: number, className?: string }) {
  const [currentState, setCurrentState] = useState(0);

  useEffect(() => {
    if (!loading) {
      setCurrentState(0);
      return;
    }
    const timeout = setTimeout(() => {
      setCurrentState((prevState) =>
        agentSteps.length - 1 === prevState ? prevState : prevState + 1
      );
    }, duration);

    return () => clearTimeout(timeout);
  }, [currentState, loading, duration]);

  if (!loading) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className={cn("flex flex-col gap-2 px-4 py-3 bg-[#323232]/50 rounded-3xl border border-border/40 backdrop-blur-sm max-w-[90%]", className)}
      >
        <div className="flex flex-col gap-2">
          {agentSteps.map((state, index) => {
            const distance = Math.abs(index - currentState);
            const opacity = Math.max(1 - distance * 0.3, 0.1); 
            const isPast = index < currentState;
            const isCurrent = index === currentState;

            // Only show up to 3 visible items to keep it compact
            if (distance > 2) return null;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: opacity, x: 0 }}
                className={cn(
                  "flex items-center gap-3 text-sm transition-colors duration-300",
                  isCurrent ? "text-primary font-medium" : isPast ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <div className="flex items-center justify-center w-4 h-4 shrink-0">
                  {isPast ? (
                     <CheckCircle2 className="w-full h-full text-primary" />
                  ) : isCurrent ? (
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="size-[3px] rounded-full bg-current" style={{ animation: `ikamva-dot 1s ${i * 0.15}s infinite ease-in-out` }} />
                      ))}
                    </span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                  )}
                </div>
                <span className={cn(isPast && "line-through opacity-70")}>{state.text}</span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
