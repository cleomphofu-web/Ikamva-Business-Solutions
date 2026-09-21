import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function FlipWords({
  words,
  duration = 3000,
  className,
}) {
  const [currentWord, setCurrentWord] = useState(words[0]);
  const [isAnimating, setIsAnimating] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isAnimating) {
      const timeout = setTimeout(() => {
        const currentIndex = words.indexOf(currentWord);
        const nextWord = words[currentIndex + 1] || words[0];
        setCurrentWord(nextWord);
        setIsAnimating(true);
      }, duration);
      return () => clearTimeout(timeout);
    }
  }, [isAnimating, duration, words, currentWord]);

  return (
    <span className={cn("inline-block relative min-w-[6.2ch] text-left", className)}>
      <span className="sr-only">{words.join(", ")}</span>
      <AnimatePresence
        onExitComplete={() => {
          setIsAnimating(false);
        }}
      >
        <motion.span
          key={currentWord}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: -10, position: "absolute" }
          }
          transition={{
            duration: 0.4,
            ease: "easeInOut",
          }}
          className="inline-block whitespace-nowrap"
          aria-hidden="true"
        >
          {currentWord}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
