import { useEffect, useState } from "react";
import { EmptyState, PageHeader } from "@/components/ikamva/primitives";
import { employeeApi, workforceApi } from "@/lib/ikamva/api-client";
import { MissionControlErrorBoundary } from "./MissionControlErrorBoundary";

const TONE: Record<string, string> = { neutral: "var(--state-idle)", success: "var(--state-working)", failed: "var(--state-failed)" };

function LogsContent() {
  const [employeeName, setEmployeeName] = useState("your Employee");
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chains, setChains] = useState<any[]>([]);
  useEffect(() => { void Promise.all([employeeApi.getMine(), workforceApi.listActivityLogs(), workforceApi.listChains()]).then(([employee, result, chainResult]) => { setEmployeeName(employee.employee?.name || "your Employee"); setLogs(result.logs || []); setChains(chainResult.chains || []); }).catch((e) => setError(e.message || "Unable to load activity logs.")).finally(() => setLoading(false)); }, []);
  return <div className="flex flex-col gap-8">
    <PageHeader eyebrow="Logs" title="Every step, in order" description={`You can always see exactly what ${employeeName} did, in the order she did it — no hidden activity.`} />
    {chains.length > 0 && <section className="flex flex-col gap-3"><h2 className="text-lg font-semibold">Task chains</h2>{chains.map((chain) => <details key={chain.parentTask?.id} className="rounded-2xl border border-border p-4"><summary className="cursor-pointer list-none"><span className="font-medium">{chain.parentTask?.payload?.classification?.category || "task_chain"}</span><span className="ml-3 text-sm text-muted-foreground">{chain.currentStep?.step_name || "Complete"} · Step {Math.min((chain.currentStep?.step_index ?? chain.steps.length - 1) + 1, chain.parentTask?.chain_config?.steps?.length || chain.steps.length)} of {chain.parentTask?.chain_config?.steps?.length || chain.steps.length} · {chain.overallStatus}</span></summary><ol className="mt-4 flex flex-col gap-2">{chain.steps.map((step: any) => <li key={step.id} className="flex items-center justify-between border-t border-border pt-2 text-sm"><span>{step.step_name || step.task_type}</span><span className="text-muted-foreground">{step.status} · {step.completed_at ? new Date(step.completed_at).toLocaleString() : "—"}</span></li>)}</ol></details>)}</section>}
    {loading ? <p className="text-sm text-muted-foreground">Loading live activity…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : logs.length === 0 ? (
      <EmptyState
        headline="No activity recorded yet."
        why={`${employeeName} will log every step here once she starts working — emails triaged, quotes generated, approvals sent, and more.`}
        actions={[]}
      />
    ) : <ol className="relative flex flex-col gap-6 pl-8"><span aria-hidden className="absolute top-2 bottom-2 left-[0.42rem] w-px bg-border" />{logs.map((e) => { const tone = e.error ? "failed" : e.action === "chat_interaction" ? "success" : "neutral"; return <li key={e.id} className="relative min-w-0"><span aria-hidden className="absolute top-1.5 -left-[1.62rem] size-2.5 rounded-full" style={{ background: TONE[tone], boxShadow: `0 0 12px ${TONE[tone]}` }} /><div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3"><span className="text-sm text-muted-foreground tabular-nums">{new Date(e.occurred_at || e.created_at).toLocaleString()}</span><span><span className="block text-sm font-medium">{e.action}</span>{e.result && <span className="block text-sm text-muted-foreground">{typeof e.result === "string" ? e.result : e.result.output?.content || "Completed"}</span>}</span></div></li>; })}</ol>}
  </div>;
}
function LogsPage() { return <MissionControlErrorBoundary><LogsContent /></MissionControlErrorBoundary>; }
export default LogsPage;
