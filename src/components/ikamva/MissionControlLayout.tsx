import { useEffect, useState, type ReactNode } from "react";
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
import { employeeApi } from "@/lib/ikamva/api-client";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/dashboard/context", label: "Context", icon: BrainCircuit },
  { to: "/dashboard/rules", label: "Rules", icon: Shield },
  { to: "/dashboard/schedule", label: "Schedule", icon: CalendarClock },
  { to: "/dashboard/skills", label: "Skills & Jobs", icon: Sparkle },
  { to: "/dashboard/hours", label: "Monthly Hours", icon: Timer },
  { to: "/dashboard/tokens", label: "Token Usage", icon: Gauge },
  { to: "/dashboard/tools", label: "More Tools", icon: Plug },
  { to: "/dashboard/approvals", label: "Approvals & Notifications", icon: BellRing },
  { to: "/dashboard/logs", label: "Logs", icon: ScrollText },
] as const;

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const pathname = location.pathname;
  const [activeEmployee, setActiveEmployee] = useState<any>(employee);
  useEffect(() => { void employeeApi.getMine().then(({ employee: record }) => { if (record) setActiveEmployee(record); }).catch(() => undefined); }, []);
  const meta = STATE_META[activeEmployee?.state || "idle"] || STATE_META.idle;
  const companyName = activeEmployee?.configuration?.company_name || workspace.companyName;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-4 py-6">
      <div className="flex min-w-0 items-center gap-3 px-2">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-sm font-semibold text-primary">
          IK
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{companyName}</p>
          <p className="truncate text-xs text-muted-foreground">{workspace.tagline}</p>
        </div>
      </div>

      <Link
        to="/dashboard"
        onClick={onNavigate}
        className="glass flex min-w-0 items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-sidebar-accent/60"
      >
        <EmployeeOrb state={activeEmployee?.state || "idle"} initials={activeEmployee?.name?.[0] ?? "S"} size={44} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{activeEmployee?.name || "Your Employee"}</p>
          <p className="truncate text-xs text-muted-foreground">{activeEmployee?.role || "AI Employee"}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px]" style={{ color: meta.color }}>
            <StatusDot state={activeEmployee?.state || "idle"} />
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
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-sidebar-border pt-4">
        <Link
          to="/dashboard/account"
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
            pathname === "/dashboard/account"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
          )}
        >
          <CircleUser className="size-4 shrink-0" />
          <span className="truncate">Account</span>
        </Link>
      </div>
    </div>
  );
}

export function MissionControlLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--ikamva-sidebar)] border-r border-sidebar-border bg-transparent backdrop-blur-2xl lg:block [--ikamva-sidebar:17rem]">
        <SidebarInner />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="animate-slide-in absolute inset-y-0 left-0 w-[min(19rem,85vw)] border-r border-sidebar-border bg-transparent backdrop-blur-2xl">
            <button
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="absolute top-5 right-4 z-10 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <SidebarInner onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="relative z-10 lg:pl-[17rem]">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-transparent px-4 py-3 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground"
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

        <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
          {children}
        </main>
      </div>
    </div>
  );
}
