import React, { useState, useRef, useEffect, ReactNode } from "react";
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
  Users,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
import { EmployeeOrb, STATE_META, StatusDot } from "./employee-orb";
import { employee, workspace } from "@/lib/ikamva/workspace-adapter";
import { employeeApi } from "@/lib/ikamva/api-client";
import { AgentActivityTicker } from "@/pages/client/MissionControl/AgentActivityTicker";

// ─── Navigation data (unchanged) ───────────────────────────────────────────
const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/dashboard/team", label: "Team & Specialists", icon: Users },
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

// ─── Motion variants ─────────────────────────────────────────────────────────
const labelVariants = {
  hidden: { opacity: 0, x: -6, width: 0 },
  visible: { opacity: 1, x: 0, width: "auto" },
};

// ─── Tooltip wrapper for collapsed icons ─────────────────────────────────────
function NavTooltip({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  if (!collapsed) return <>{children}</>;
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={12}
            className="z-[200] rounded-lg bg-[#0a0a05] px-3 py-1.5 text-xs font-medium text-[#fafaf9] shadow-xl ring-1 ring-white/10"
          >
            {label}
            <Tooltip.Arrow className="fill-[#0a0a05]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

// ─── Sidebar inner content ────────────────────────────────────────────────────
function SidebarInner({
  onNavigate,
  collapsed,
}: {
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  const location = useLocation();
  const pathname = location.pathname;
  const [activeEmployee, setActiveEmployee] = useState<any>(employee);

  useEffect(() => {
    void employeeApi
      .getMine()
      .then(({ employee: record }) => {
        if (record) setActiveEmployee(record);
      })
      .catch(() => undefined);
  }, []);

  const meta = STATE_META[activeEmployee?.state || "idle"] || STATE_META.idle;
  const companyName =
    activeEmployee?.configuration?.company_name || workspace.companyName;

  return (
    <div className="flex h-full flex-col overflow-y-auto overflow-x-hidden py-6">
      {/* ── Brand header ── */}
      <div
        className={cn(
          "flex min-w-0 items-center gap-3 px-4 mb-6 transition-all duration-300",
          collapsed ? "justify-center px-3" : "justify-start"
        )}
      >
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-sm font-semibold text-primary">
          IK
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              variants={labelVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="min-w-0 overflow-hidden"
            >
              <p className="truncate text-sm font-semibold text-[#fafaf9]">
                {companyName}
              </p>
              <p className="truncate text-xs text-[#fafaf9]/50">
                {workspace.tagline}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Employee card ── */}
      <div className="px-3 mb-6">
        <NavTooltip label={activeEmployee?.name || "Your Employee"} collapsed={collapsed}>
          <Link
            to="/dashboard"
            onClick={onNavigate}
            className={cn(
              "flex min-w-0 items-center rounded-2xl transition-all duration-200",
              "hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              collapsed ? "justify-center p-2" : "gap-3 px-3 py-3"
            )}
          >
            <EmployeeOrb
              state={activeEmployee?.state || "idle"}
              initials={activeEmployee?.name?.[0] ?? "S"}
              size={collapsed ? 36 : 44}
            />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  variants={labelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="min-w-0 overflow-hidden"
                >
                  <p className="truncate text-sm font-semibold">
                    {activeEmployee?.name || "Your Employee"}
                  </p>
                  <p className="truncate text-xs text-[#fafaf9]/50">
                    {activeEmployee?.role || "AI Employee"}
                  </p>
                  <p
                    className="mt-1 flex items-center gap-1.5 text-[11px]"
                    style={{ color: meta.color }}
                  >
                    <StatusDot state={activeEmployee?.state || "idle"} />
                    {meta.label}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
        </NavTooltip>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex min-w-0 flex-col gap-1 px-3 flex-1">
        {NAV.map((item) => {
          const active = pathname === item.to;
          return (
            <NavTooltip key={item.to} label={item.label} collapsed={collapsed}>
              <Link
                to={item.to}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "group flex min-w-0 items-center rounded-xl transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  collapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-[#fafaf9]/55 hover:bg-white/6 hover:text-[#fafaf9]"
                )}
              >
                <item.icon
                  className={cn(
                    "shrink-0 transition-transform duration-200 group-hover:scale-110",
                    collapsed ? "size-5" : "size-4",
                    active ? "text-primary" : ""
                  )}
                />
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      variants={labelVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="truncate text-sm overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {active && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            </NavTooltip>
          );
        })}
      </nav>

      {/* ── Footer: Account ── */}
      <div className="mt-auto border-t border-white/10 pt-4 px-3">
        <NavTooltip label="Account" collapsed={collapsed}>
          <Link
            to="/dashboard/account"
            onClick={onNavigate}
            aria-label="Account"
            className={cn(
              "flex min-w-0 items-center rounded-xl transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              collapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
              pathname === "/dashboard/account"
                ? "bg-primary/15 text-primary"
                : "text-[#fafaf9]/55 hover:bg-white/6 hover:text-[#fafaf9]"
            )}
          >
            <CircleUser className={cn("shrink-0", collapsed ? "size-5" : "size-4")} />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  variants={labelVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="truncate text-sm overflow-hidden whitespace-nowrap"
                >
                  Account
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </NavTooltip>
      </div>
    </div>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────
export function MissionControlLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expand on hover with a small delay to prevent flicker
  const handleMouseEnter = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setHovered(true), 80);
  };
  const handleMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setHovered(false), 120);
  };

  const COLLAPSED_W = 80;
  const EXPANDED_W = 272;

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex-1-container flex flex-col">
      {/* ── Desktop sidebar ── */}
      <motion.aside
        className="fixed inset-y-0 left-0 z-30 hidden border-r border-white/10 lg:flex flex-col overflow-hidden"
        style={{
          background: "rgba(5, 5, 10, 0.65)",
          backdropFilter: "blur(16px)",
        }}
        animate={{ width: hovered ? EXPANDED_W : COLLAPSED_W }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <SidebarInner collapsed={!hovered} />
      </motion.aside>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-y-0 left-0 flex flex-col border-r border-white/10"
              style={{
                width: "min(19rem, 85vw)",
                background: "rgba(5, 5, 10, 0.92)",
                backdropFilter: "blur(20px)",
              }}
            >
              <button
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="absolute top-5 right-4 z-10 rounded-lg p-1.5 text-[#fafaf9]/50 hover:text-[#fafaf9] transition-colors"
              >
                <X className="size-4" />
              </button>
              <SidebarInner collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Main content area ── */}
      {/* Mobile: no left padding (sidebar is a drawer overlay) */}
      {/* Desktop: animated left padding matching sidebar width */}
      <div className="relative z-10 flex-1-container flex flex-col lg:hidden">
        <header
          className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 px-4 py-3"
          style={{ background: "rgba(5,5,10,0.7)", backdropFilter: "blur(12px)" }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg border border-white/15 p-2 text-[#fafaf9]/55 hover:text-[#fafaf9] transition-colors"
          >
            <Menu className="size-4" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot state={employee.state} />
            <p className="truncate text-sm font-medium">
              {employee.name} · {STATE_META[employee.state].label}
            </p>
          </div>
          <Link to="/dashboard/approvals" className="ml-auto shrink-0 text-[#fafaf9]/55">
            <Activity className="size-4" />
          </Link>
        </header>
        <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <AgentActivityTicker />
          {children}
        </main>
      </div>

      <motion.div
        className="relative z-10 flex-1-container flex-col hidden lg:flex"
        animate={{ paddingLeft: hovered ? EXPANDED_W : COLLAPSED_W }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-14">
          <AgentActivityTicker />
          {children}
        </main>
      </motion.div>
    </div>
  );
}
