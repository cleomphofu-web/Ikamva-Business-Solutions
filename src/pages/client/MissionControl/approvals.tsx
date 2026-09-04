import { useEffect, useState } from "react";
import { EmptyState, PageHeader } from "@/components/ikamva/primitives";
import { Button } from "@/components/ui/button";
import { employeeApi, workforceApi } from "@/lib/ikamva/api-client";
import { toast } from "sonner";



function ApprovalsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [employee, setEmployee] = useState<any>({ name: "your Employee" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { void Promise.all([employeeApi.getMine(), workforceApi.listApprovals()]).then(([e, a]) => { setEmployee(e.employee || { name: "your Employee" }); setItems(a.approvals || []); }).catch((e) => setError(e.message || "Unable to load approvals.")).finally(() => setLoading(false)); }, []);
  const pending = items.filter((a) => a.status === "pending");

  async function decide(id: string, status: "approved" | "rejected") {
    try { const result = await workforceApi.decideApproval(id, status); setItems((prev) => prev.map((a) => (a.id === id ? result.approval : a))); toast("Decision recorded."); }
    catch (e: any) { toast.error(e.message || "Could not save decision."); }
  }

  return (
    <>
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Approvals & Notifications"
          title={`${employee.name} asks before she acts`}
          description="Every request explains what she wants to do, why, what data she will use and which system it affects."
        />

        {loading ? <p className="text-sm text-muted-foreground">Loading live approvals…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : pending.length === 0 ? (
          <EmptyState
            headline="Nothing is waiting for you."
            why={`${employee.name} will pause and ask here whenever she needs permission to act outside your workspace.`}
            actions={[{ label: "Review her rules", variant: "outline" }]}
          />
        ) : (
          <div className="flex flex-col gap-5">
            {pending.map((a) => (
              <article
                key={a.id}
                className="glass animate-attention rounded-3xl p-6 sm:p-7"
                style={{ borderColor: "color-mix(in oklab, var(--state-approval) 35%, transparent)" }}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <h2 className="min-w-0 text-lg font-semibold">
                    {employee.name} wants to {(a.action || "complete an action").toLowerCase()}
                  </h2>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{a.created_at ? new Date(a.created_at).toLocaleString() : "—"}</span>
                </div>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  {[
                    ["Reason", a.reasoning_summary || "—"],
                    ["Data", (a.action_payload || a.payload) ? JSON.stringify(a.action_payload || a.payload) : "—"],
                    ["System", a.provider || (a.action?.startsWith("gmail") ? "Gmail" : "—")],
                    ["Permission", a.status === "pending" ? "Approval required" : a.status],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{k}</dt>
                      <dd className="mt-1 text-sm leading-relaxed">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Button onClick={() => decide(a.id, "approved")}>Approve</Button>
                  <Button variant="outline" onClick={() => decide(a.id, "rejected")}>
                    Reject
                  </Button>
                  <Button variant="ghost" onClick={() => toast("Full request detail opens with the engine connection.")}>
                    Review
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        {items.some((a) => a.status !== "pending") && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm tracking-wide text-muted-foreground uppercase">Decided</h2>
            {items
              .filter((a) => a.status !== "pending")
              .map((a) => (
                <div
                  key={a.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 px-4 py-3"
                >
                  <p className="min-w-0 truncate text-sm">{a.action || "Action request"}</p>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-xs capitalize"
                    style={{
                      color: a.status === "approved" ? "var(--state-working)" : "var(--state-failed)",
                    }}
                  >
                    {a.status}
                  </span>
                </div>
              ))}
          </div>
        )}

      </div>
    </>
  );
}

export default ApprovalsPage;
