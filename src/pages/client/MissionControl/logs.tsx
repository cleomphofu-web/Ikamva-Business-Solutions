import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ikamva/primitives";
import { employeeApi, workforceApi } from "@/lib/ikamva/api-client";

const TONE: Record<string, string> = { neutral: "var(--state-idle)", success: "var(--state-working)", failed: "var(--state-failed)" };

function LogsPage() {
  const [employeeName, setEmployeeName] = useState("your Employee");
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { void Promise.all([employeeApi.getMine(), workforceApi.listActivityLogs()]).then(([employee, result]) => { setEmployeeName(employee.employee?.name || "your Employee"); setLogs(result.logs || []); }).catch((e) => setError(e.message || "Unable to load activity logs.")).finally(() => setLoading(false)); }, []);
  return <div className="flex flex-col gap-8">
    <PageHeader eyebrow="Logs" title="Every step, in order" description={`You can always see exactly what ${employeeName} did, in the order she did it — no hidden activity.`} />
    {loading ? <p className="text-sm text-muted-foreground">Loading live activity…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : logs.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : <ol className="relative flex flex-col gap-6 pl-8"><span aria-hidden className="absolute top-2 bottom-2 left-[0.42rem] w-px bg-border" />{logs.map((e) => { const tone = e.error ? "failed" : e.action === "chat_interaction" ? "success" : "neutral"; return <li key={e.id} className="relative min-w-0"><span aria-hidden className="absolute top-1.5 -left-[1.62rem] size-2.5 rounded-full" style={{ background: TONE[tone], boxShadow: `0 0 12px ${TONE[tone]}` }} /><div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3"><span className="text-sm text-muted-foreground tabular-nums">{new Date(e.occurred_at || e.created_at).toLocaleString()}</span><span><span className="block text-sm font-medium">{e.action}</span>{e.result && <span className="block text-sm text-muted-foreground">{typeof e.result === "string" ? e.result : e.result.output?.content || "Completed"}</span>}</span></div></li>; })}</ol>}
  </div>;
}
export default LogsPage;
