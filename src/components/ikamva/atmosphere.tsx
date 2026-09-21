import { useEffect, useState } from "react";

type AtmoTheme = { a: string; b: string; c: string };

const THEMES: [AtmoTheme, ...AtmoTheme[]] = [
  { a: "oklch(0.78 0.2 135)", b: "oklch(0.68 0.16 170)", c: "oklch(0.62 0.13 200)" }, // lime -> teal
  { a: "oklch(0.76 0.18 110)", b: "oklch(0.7 0.13 85)", c: "oklch(0.66 0.11 155)" }, // citrus -> moss
  { a: "oklch(0.62 0.14 195)", b: "oklch(0.58 0.18 250)", c: "oklch(0.6 0.13 215)" }, // teal -> blue
  { a: "oklch(0.66 0.15 165)", b: "oklch(0.68 0.14 200)", c: "oklch(0.6 0.14 180)" }, // emerald -> cyan
  { a: "oklch(0.72 0.15 75)", b: "oklch(0.68 0.17 45)", c: "oklch(0.62 0.14 30)" }, // amber -> orange
];

/**
 * AnimatedGradient / atmospheric workspace backdrop.
 * A controlled, randomly selected theme per session. Always low-contrast so
 * text on top stays readable.
 */
export function Atmosphere() {
  const [theme, setTheme] = useState(THEMES[0]);

  useEffect(() => {
    setTheme(THEMES[Math.floor(Math.random() * THEMES.length)] ?? THEMES[0]);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden grain">
      <div className="absolute inset-0 bg-background" />
      <div
        className="animate-drift absolute -top-[30vh] left-[-10vw] h-[70vh] w-[70vw] rounded-full opacity-40 blur-[120px]"
        style={{ background: `radial-gradient(circle, ${theme.a}, transparent 70%)` }}
      />
      <div
        className="animate-drift absolute top-[20vh] right-[-15vw] h-[65vh] w-[60vw] rounded-full opacity-30 blur-[130px]"
        style={{ background: `radial-gradient(circle, ${theme.b}, transparent 70%)`, animationDelay: "-8s" }}
      />
      <div
        className="animate-drift absolute bottom-[-25vh] left-[25vw] h-[55vh] w-[55vw] rounded-full opacity-25 blur-[140px]"
        style={{ background: `radial-gradient(circle, ${theme.c}, transparent 70%)`, animationDelay: "-16s" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,var(--background)_85%)]" />
    </div>
  );
}
