import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  BellRing,
  BrainCircuit,
  CalendarClock,
  CircleUser,
  Gauge,
  LayoutGrid,
  Menu,
  Plug,
  ScrollText,
  Shield,
  Sparkle,
  Timer,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmployeeOrb, STATE_META, StatusDot } from "./employee-orb";
import { employee, workspace } from "@/lib/ikamva/workspace-adapter";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid },
  { to: "/context", label: "Context", icon: BrainCircuit },
  { to: "/rules", label: "Rules", icon: Shield },
  { to: "/schedule", label: "Schedule", icon: CalendarClock },
  { to: "/skills", label: "Skills & Jobs", icon: Sparkle },
  { to: "/hours", label: "Monthly Hours", icon: Timer },
  { to: "/tokens", label: "Token Usage", icon: Gauge },
  { to: "/tools", label: "More Tools", icon: Plug },
  { to: "/approvals", label: "Approvals & Notifications", icon: BellRing },
  { to: "/logs", label: "Logs", icon: ScrollText },
] as const;

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useLocation().pathname;
  const meta = STATE_META[employee.state];

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-5">
      <div className="flex min-w-0 items-center gap-3 rounded-[1.5rem] bg-white/55 px-3 py-3 shadow-sm ring-1 ring-emerald-950/10 backdrop-blur-xl">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-[0_12px_30px_-18px_hsla(var(--glow-primary),0.8)]">
          IK
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{workspace.companyName}</p>
          <p className="truncate text-xs text-muted-foreground">{workspace.tagline}</p>
        </div>
      </div>

      <Link
        to="/"
        onClick={onNavigate}
        className="group flex min-w-0 items-center gap-3 rounded-[1.65rem] bg-white/60 px-3 py-3 shadow-[0_20px_60px_-38px_rgba(23,55,39,0.45)] ring-1 ring-emerald-950/10 backdrop-blur-2xl transition-all hover:-translate-y-0.5 hover:bg-white/75"
      >
        <EmployeeOrb state={employee?.state || "idle"} initials={employee?.name?.[0] ?? "S"} size={44} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{employee.name}</p>
          <p className="truncate text-xs text-muted-foreground">{employee.role}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color: meta.color }}>
            <StatusDot state={employee.state} />
            {meta.label}
          </p>
        </div>
      </Link>

      <nav className="flex min-w-0 flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-emerald-950 text-white shadow-[0_18px_42px_-30px_rgba(23,55,39,0.8)]"
                  : "text-emerald-950/62 hover:bg-white/55 hover:text-emerald-950",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-emerald-950/10 pt-4">
        <Link
          to="/account"
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
            pathname === "/account"
              ? "bg-emerald-950 text-white"
              : "text-emerald-950/62 hover:bg-white/55 hover:text-emerald-950",
          )}
        >
          <CircleUser className="size-4 shrink-0" />
          <span className="truncate">Account</span>
        </Link>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-emerald-950">
      {/* Desktop sidebar */}
      <motion.aside
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-y-5 left-5 z-30 hidden w-[var(--ikamva-sidebar)] rounded-[2rem] border border-emerald-950/10 bg-transparent shadow-[0_28px_90px_-52px_rgba(23,55,39,0.55)] backdrop-blur-2xl lg:block [--ikamva-sidebar:17.5rem]"
      >
        <SidebarInner />
      </motion.aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-[#f4f8e8]/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="absolute inset-y-0 left-0 w-[min(19rem,85vw)] border-r border-emerald-950/10 bg-transparent backdrop-blur-2xl"
          >
            <button
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="absolute top-5 right-4 z-10 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <SidebarInner onNavigate={() => setOpen(false)} />
          </motion.div>
        </div>
      )}

      <div className="relative z-10 lg:pl-[20rem]">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-emerald-950/10 bg-transparent px-4 py-3 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="rounded-xl border border-emerald-950/10 bg-white/55 p-2 text-emerald-950/65 hover:text-emerald-950"
          >
            <Menu className="size-4" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot state={employee.state} />
            <p className="truncate text-sm font-medium">
              {employee.name} · {STATE_META[employee.state].label}
            </p>
          </div>
          <Link to="/dashboard/approvals" className="ml-auto shrink-0 text-muted-foreground">
            <Activity className="size-4" />
          </Link>
        </header>

        <motion.main
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-10"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
