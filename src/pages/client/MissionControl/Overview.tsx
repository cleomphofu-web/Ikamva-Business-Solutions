import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, BellRing, BrainCircuit, Sparkle, Target, LayoutDashboard, Database } from "lucide-react";
import { EmployeeOrb, STATE_META, StatusPill } from "@/components/ikamva/employee-orb";
import { EmployeeChat } from "@/components/ikamva/employee-chat";
import { CapacityMeter, EmptyState, Panel } from "@/components/ikamva/primitives";
import { ScrollFloat } from "@/components/ikamva/ScrollFloat";
import { GlassIcons } from "@/components/ikamva/GlassIcons";
import { workspace } from "@/lib/ikamva/workspace-adapter";
import { accountOpsApi, employeeApi, workforceApi } from "@/lib/ikamva/api-client";
import { MissionControlErrorBoundary } from "./MissionControlErrorBoundary";
import { AgentActivityTicker } from "./AgentActivityTicker";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function Overview() {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState({ name: "your Employee", role: "AI Employee", lifecycle_status: "pending" });
  const [approvals, setApprovals] = useState([]);
  const [logs, setLogs] = useState([]);
  const [accountCapacity, setAccountCapacity] = useState(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [dataError, setDataError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    Promise.all([employeeApi.getMine(), workforceApi.listApprovals(), workforceApi.listActivityLogs({ limit: 5 }), accountOpsApi.summary()])
      .then(([employeeData, approvalData, logData, accountData]) => {
        if (cancelled) return;
        setEmployee(employeeData.employee || { name: "your Employee", role: "AI Employee", lifecycle_status: "pending" });
        setApprovals(approvalData.approvals || []);
        setLogs(logData.logs || logData.activity_logs || []);
        setAccountCapacity(accountData.capacity || null);
        setShowUpgradePrompt((logData.logs || logData.activity_logs || []).some((item) => item?.status === "completed" || item?.result));
      })
      .catch((error) => { if (!cancelled) setDataError(error?.message || "Unable to load live workspace data."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const employeeState = employee?.lifecycle_status === "active" ? "working" : "offline";
  const meta = STATE_META[employeeState];
  const employeeName = employee?.name || "your Employee";
  const employeeRole = employee?.role || "AI Employee";
  const pending = Array.isArray(approvals) ? approvals.filter((a) => a?.status === "pending") : [];

  const quickActions = [
    { label: "Teach", icon: <BrainCircuit className="size-6" />, action: () => navigate("/dashboard/context") },
    { label: "Start a job", icon: <ArrowRight className="size-6" />, action: () => navigate("/dashboard/skills") },
    { label: "Skills", icon: <Sparkle className="size-6" />, action: () => navigate("/dashboard/skills") },
    { label: "Approvals", icon: <Target className="size-6" />, action: () => navigate("/dashboard/approvals") },
    { label: "Tools", icon: <LayoutDashboard className="size-6" />, action: () => navigate("/dashboard/tools") },
    { label: "Logs", icon: <Database className="size-6" />, action: () => navigate("/dashboard/logs") },
  ];

  return (
    <>
      <div className="flex flex-col gap-10 lg:gap-14">
        <section className="animate-fade-in flex flex-col items-center pt-2 text-center sm:pt-6">
          <EmployeeOrb state={employee?.state || employeeState} initials={employeeName[0] ?? "S"} size={132} />
          <ScrollFloat direction="up" duration={1.2} distance={40} delay={0.1}>
            <h1 className="mt-8 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
              {greeting()}, {workspace.operatorFirstName}.
            </h1>
          </ScrollFloat>
          <ScrollFloat direction="up" duration={1.2} distance={30} delay={0.2}>
              <p className="mt-4 max-w-xl text-base text-muted-foreground/80 sm:text-lg">
              {employeeName} · {employeeRole} — {meta?.blurb?.toLowerCase?.() || "ready to help"}
            </p>
          </ScrollFloat>
          <div className="mt-6">
            <StatusPill state={employee?.state || employeeState} />
          </div>
          <p className="mt-3 max-w-md text-sm text-muted-foreground/70">{employee?.stateDetail || "Your Employee is ready when you are."}</p>
        </section>

        <section className="mx-auto w-full max-w-3xl">
          <ScrollFloat direction="up" duration={0.8} delay={0.3}>
            <p className="mb-5 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase">
              What would you like {employeeName} to do?
            </p>
            <EmployeeChat
              suggestions={["Ask about work", "Review activity", "Start a job"]}
            />
          </ScrollFloat>
        </section>

        {showUpgradePrompt && (
          <section className="mx-auto w-full max-w-3xl rounded-3xl border border-primary/20 bg-primary/10 p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">First value delivered</p>
            <h2 className="mt-2 text-xl font-semibold">Unlock more ways for {employeeName} to help</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Your Employee has completed work successfully. Unlock additional capabilities such as Calendar Management — R299/month.</p>
            <div className="mt-4 flex justify-center gap-3">
              <a href="mailto:your-business-email@ikamva.co.za" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Discuss an upgrade</a>
              <button type="button" className="rounded-full border border-border px-4 py-2 text-sm" onClick={() => setShowUpgradePrompt(false)}>Not now</button>
            </div>
          </section>
        )}

        <AgentActivityTicker />

        <section className="mx-auto flex flex-col items-center justify-center pt-4 w-full">
          <ScrollFloat direction="up" duration={0.8} delay={0.4}>
             <p className="mb-6 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase">Quick Actions</p>
             <GlassIcons items={quickActions} className="justify-center" />
          </ScrollFloat>
        </section>

        {loading && <p className="text-center text-sm text-muted-foreground">Loading your workspace…</p>}

        {!loading && dataError && (
          <p role="alert" className="text-center text-sm text-destructive">{dataError}</p>
        )}

        {!loading && !dataError && pending.length === 0 && logs.length === 0 && (
          <EmptyState
            headline="Nothing has happened yet."
            why={`${employeeName} will show activity here as soon as she starts working — approvals, completed tasks, and memory entries all appear on this page.`}
            actions={[{ label: "Set up her skills", variant: "outline", onClick: () => navigate("/dashboard/skills") }]}
          />
        )}

        {pending.length > 0 && (
          <ScrollFloat direction="up" duration={0.8} delay={0.1}>
            <Panel
              title={`${employeeName} is waiting on you`}
              description={`${pending.length} action${pending.length > 1 ? "s" : ""} need your approval before she can continue.`}
              actions={
                <Link
                  to="/dashboard/approvals"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md transition-transform hover:scale-105"
                >
                  Review <ArrowRight className="size-3.5" />
                </Link>
              }
            >
              <ul className="flex flex-col gap-3">
                {pending.map((a) => (
                  <li
                    key={a?.id}
                    className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm px-4 py-3 shadow-sm transition-colors hover:bg-white/10"
                  >
                    <BellRing className="mt-0.5 size-4 shrink-0 text-[color:var(--state-approval)]" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground/90">{a?.action || "Approval requested"}</p>
                      <p className="mt-1 text-sm text-muted-foreground/80">{a?.reasoning_summary || "Review this action before the Employee continues."}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </ScrollFloat>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <ScrollFloat direction="left" duration={0.8} distance={20} delay={0.2}>
            <Panel
              title="Capacity this month"
              description="When capacity runs out, your Employee pauses. Nothing continues silently."
              actions={
                <Link to="/dashboard/hours" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Details
                </Link>
              }
            >
              <div className="flex flex-col gap-6">
                <CapacityMeter label="Monthly tasks" used={accountCapacity?.tasks_used ?? 0} total={accountCapacity?.tasks_limit ?? 0} />
                <CapacityMeter
                  label="Monthly hours"
                  used={accountCapacity?.hours_used ?? 0}
                  total={accountCapacity?.hours_limit ?? 0}
                  tone="var(--chart-2)"
                />
                <CapacityMeter
                  label="AI token usage"
                  used={0}
                  total={0}
                  tone="var(--chart-3)"
                  format={(n) => `${(n / 1_000_000).toFixed(2)}M`}
                />
              </div>
            </Panel>
          </ScrollFloat>

          <ScrollFloat direction="right" duration={0.8} distance={20} delay={0.2}>
            <Panel
              title="Latest activity"
              description="Every step your Employee takes, in plain language."
              actions={
                <Link to="/dashboard/logs" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  All logs
                </Link>
              }
            >
              {dataError && <p role="alert" className="mb-3 text-sm text-destructive">{dataError}</p>}
              {!loading && !dataError && logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet. {employeeName} will log every step here once she starts working.</p>
              ) : (
              <ol className="flex flex-col gap-4">
                {(Array.isArray(logs) ? logs : []).map((e) => (
                  <li key={e.id} className="grid grid-cols-[3.2rem_minmax(0,1fr)] gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                    <span className="text-sm text-muted-foreground/60 tabular-nums">{e?.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground/80">{e?.action || e?.task_type || "Activity recorded"}</span>
                      {(e?.result || e?.error) && (
                        <span className="mt-0.5 block text-[13px] text-muted-foreground/70">{e?.error || (typeof e?.result === "string" ? e.result : "Completed")}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              )}
            </Panel>
          </ScrollFloat>
        </div>

      </div>
    </>
  );
}

function OverviewPage() { return <MissionControlErrorBoundary><Overview /></MissionControlErrorBoundary>; }
export default OverviewPage;
