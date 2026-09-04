import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { IS_PREVIEW_DATA } from "@/lib/ikamva/workspace-adapter";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions = [],
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="animate-fade-in grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl lg:text-4xl">{title}</h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  children,
  className,
  title,
  description,
  actions,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("glass animate-fade-in rounded-3xl p-5 sm:p-7", className)}>
      {(title || actions) && (
        <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>}
            {description && (
              <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  headline,
  why,
  actions = [],
  icon,
}: {
  headline: string;
  why: string;
  actions?: { label: string; onClick?: () => void; variant?: "default" | "outline" }[];
  icon?: ReactNode;
}) {
  return (
    <div className="animate-scale-in flex flex-col items-center rounded-3xl border border-dashed border-border px-6 py-14 text-center">
      {icon && <div className="mb-5 text-primary">{icon}</div>}
      <h3 className="max-w-md text-xl font-semibold text-balance-tight">{headline}</h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{why}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {actions.map((a) => (
          <Button key={a.label} variant={a.variant ?? "default"} onClick={a.onClick}>
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function CapacityMeter({
  label,
  used,
  total,
  unit = "",
  format,
  tone = "var(--primary)",
}: {
  label: string;
  used: number;
  total: number;
  unit?: string;
  format?: (n: number) => string;
  tone?: string;
}) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const f = format ?? ((n: number) => String(n));
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-display text-sm font-semibold">
          {f(used)}
          {unit} <span className="text-muted-foreground">/ {f(total)}{unit}</span>
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, color-mix(in oklab, ${tone} 55%, transparent), ${tone})`,
            boxShadow: `0 0 18px color-mix(in oklab, ${tone} 45%, transparent)`,
          }}
        />
      </div>
    </div>
  );
}

/** Honest labelling: this build is not connected to live backend data. */
export function PreviewDataNote({ what }: { what: string }) {
  if (!IS_PREVIEW_DATA) return null;
  return (
    <p className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>Interface preview — {what} is not connected to live data yet.</span>
    </p>
  );
}

export function ComingSoon({ label = "Coming soon" }: { label?: string }) {
  return (
    <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}
