import { cn } from "@/lib/utils";
import type { EmployeeState } from "@/lib/ikamva/types";

export const STATE_META: Record<
  EmployeeState,
  { label: string; color: string; motion: string; blurb: string }
> = {
  idle: {
    label: "Idle",
    color: "var(--state-idle)",
    motion: "",
    blurb: "Ready and waiting for work.",
  },
  thinking: {
    label: "Thinking",
    color: "var(--state-thinking)",
    motion: "animate-breathe",
    blurb: "Working out how to approach the task.",
  },
  working: {
    label: "Working",
    color: "var(--state-working)",
    motion: "animate-breathe",
    blurb: "Actively running a task right now.",
  },
  waiting: {
    label: "Waiting",
    color: "var(--state-waiting)",
    motion: "animate-breathe",
    blurb: "Waiting on a person or a system to respond.",
  },
  approval: {
    label: "Approval required",
    color: "var(--state-approval)",
    motion: "animate-breathe",
    blurb: "Paused until you approve the next action.",
  },
  paused: {
    label: "Paused",
    color: "var(--state-paused)",
    motion: "",
    blurb: "Stopped on purpose. Nothing is running in the background.",
  },
  failed: {
    label: "Needs attention",
    color: "var(--state-failed)",
    motion: "",
    blurb: "The last task could not be completed.",
  },
  suspended: {
    label: "Suspended",
    color: "var(--state-failed)",
    motion: "",
    blurb: "Capacity or account limit reached.",
  },
};

export function StatusDot({ state, className }: { state: EmployeeState; className?: string }) {
  const meta = STATE_META[state] || STATE_META.idle;
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", meta.motion, className)}
      style={{ background: meta.color, boxShadow: `0 0 12px ${meta.color}` }}
    />
  );
}

export function StatusPill({ state }: { state: EmployeeState }) {
  const safeState = STATE_META[state] ? state : "idle";
  const meta = STATE_META[safeState];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
      style={{
        borderColor: `color-mix(in oklab, ${meta.color} 35%, transparent)`,
        color: meta.color,
        background: `color-mix(in oklab, ${meta.color} 10%, transparent)`,
      }}
    >
      <StatusDot state={safeState} />
      {meta?.label || "Idle"}
    </span>
  );
}

export function EmployeeOrb({
  state,
  initials,
  size = 128,
}: {
  state: EmployeeState;
  initials: string;
  size?: number;
}) {
  const safeState = STATE_META[state] ? state : "idle";
  const meta = STATE_META[safeState] || STATE_META.idle;
  const safeInitials = initials || "S";
  const safeSize = Number.isFinite(size) && size > 0 ? size : 128;
  const active = safeState === "working" || safeState === "thinking" || safeState === "waiting";

  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: safeSize, height: safeSize }}
      role="img"
      aria-label={`${safeInitials} — ${meta?.label || "Idle"}`}
    >
      {active && (
        <div
          className="animate-halo absolute inset-[-14%] rounded-full opacity-60 blur-xl"
          style={{
            background: `conic-gradient(from 0deg, transparent, ${meta.color}, transparent 65%)`,
          }}
        />
      )}
      {safeState === "approval" && (
        <div className="animate-attention absolute inset-0 rounded-full" />
      )}
      <div
        className={cn("absolute inset-[6%] rounded-full blur-md opacity-50", meta.motion)}
        style={{ background: `radial-gradient(circle at 35% 30%, ${meta.color}, transparent 70%)` }}
      />
      <div
        className="glass-strong relative grid size-full place-items-center rounded-full"
        style={{ borderColor: `color-mix(in oklab, ${meta.color} 30%, transparent)` }}
      >
        <span
          className="font-display font-semibold"
          style={{ fontSize: safeSize * 0.3, color: meta.color }}
        >
          {safeInitials}
        </span>
      </div>
    </div>
  );
}
