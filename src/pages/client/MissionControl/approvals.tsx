import { useEffect, useState } from "react";
import { EmptyState, PageHeader } from "@/components/ikamva/primitives";
import { Button } from "@/components/ui/button";
import { employeeApi, workforceApi } from "@/lib/ikamva/api-client";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Settings2, Mail, ShieldAlert, Check, X, AlertCircle } from "lucide-react";
import { MissionControlErrorBoundary } from "./MissionControlErrorBoundary";

function formatPayload(payload: any) {
  if (!payload) return null;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function ApprovalsContent() {
  const [items, setItems] = useState<any[]>([]);
  const [employee, setEmployee] = useState<any>({ name: "your Employee" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void Promise.all([employeeApi.getMine(), workforceApi.listApprovals()])
      .then(([e, a]) => {
        setEmployee(e.employee || { name: "your Employee" });
        setItems(a.approvals || []);
      })
      .catch((e) => setError(e.message || "Unable to load approvals."))
      .finally(() => setLoading(false));
  }, []);

  const pending = items.filter((a) => a.status === "pending");

  const toggleExpand = (id: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const confidenceLabel = (score: number | null | undefined) =>
    score == null
      ? null
      : score < 50
      ? "Low confidence"
      : score < 70
      ? "Uncertain"
      : score < 90
      ? "Review note"
      : null;

  async function decide(id: string, status: "approved" | "rejected") {
    try {
      const result = await workforceApi.decideApproval(
        id,
        status,
        edits[id] ? { edited_text: edits[id] } : undefined
      );
      setItems((prev) => prev.map((a) => (a.id === id ? result.approval : a)));
      toast("Decision recorded.");
    } catch (e: any) {
      toast.error(e.message || "Could not save decision.");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Approvals & Notifications"
          title={`${employee.name} asks before she acts`}
          description="Every request explains what she wants to do, why, what data she will use and which system it affects."
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading live approvals…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : pending.length === 0 ? (
          <EmptyState
            headline="Nothing is waiting for you."
            why={`${employee.name} will pause and ask here whenever she needs permission to act outside your workspace.`}
            actions={[{ label: "Review her rules", variant: "outline" }]}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {pending.map((a) => {
              const payload = a.action_payload || a.payload || {};
              const isExpanded = expandedPayloads[a.id] ?? false;
              const isEmailAction = a.action?.includes("gmail") || a.action?.includes("email");

              return (
                <article
                  key={a.id}
                  className="glass animate-attention rounded-3xl p-6 sm:p-7 border border-white/10 shadow-lg relative overflow-hidden"
                  style={{ borderColor: "color-mix(in oklab, var(--state-approval) 40%, transparent)" }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="size-9 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-foreground">
                        {isEmailAction ? <Mail className="size-4" /> : <Settings2 className="size-4" />}
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">
                          {employee.name} wants to <span className="text-white">{(a.action || "complete an action").toLowerCase()}</span>
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.reasoning_summary || a.confidence_reason || "Autonomous operation paused for human review."}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : "—"}
                    </span>
                  </div>

                  {/* Highlight Summary Grid */}
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/5 border border-white/5 rounded-2xl p-3.5 text-xs">
                    <div>
                      <span className="text-muted-foreground uppercase tracking-wider block text-[10px]">Action</span>
                      <span className="font-mono text-foreground font-medium mt-0.5 block truncate">{a.action || "action"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground uppercase tracking-wider block text-[10px]">System</span>
                      <span className="text-foreground font-medium mt-0.5 block truncate">{a.provider || (isEmailAction ? "Gmail" : "Internal")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground uppercase tracking-wider block text-[10px]">Recipient / Target</span>
                      <span className="text-foreground font-medium mt-0.5 block truncate">{payload.to || payload.sender || payload.subject || "System"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground uppercase tracking-wider block text-[10px]">Confidence</span>
                      <span className={confidenceLabel(a.confidence_score) ? "text-amber-400 font-semibold mt-0.5 block" : "text-emerald-400 font-medium mt-0.5 block"}>
                        {a.confidence_score != null ? `${a.confidence_score}%` : "Standard (100%)"}
                      </span>
                    </div>
                  </div>

                  {/* Confidence warning alert if flagged */}
                  {confidenceLabel(a.confidence_score) && (
                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2.5 text-xs text-amber-300">
                      <AlertCircle className="size-4 shrink-0 text-amber-400" />
                      <span>{confidenceLabel(a.confidence_score)}: {a.confidence_reason || "The Employee flagged uncertainty before proceeding."}</span>
                    </div>
                  )}

                  {/* Email draft text editor (if editable draft exists) */}
                  {payload.text && (
                    <div className="mt-4">
                      <label htmlFor={`edit-${a.id}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                        Edit Draft Response Before Approval:
                      </label>
                      <textarea
                        id={`edit-${a.id}`}
                        aria-label="Edit draft before approval"
                        value={edits[a.id] ?? payload.text}
                        onChange={(event) => setEdits((current) => ({ ...current, [a.id]: event.target.value }))}
                        className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/30 p-3.5 text-sm leading-relaxed text-foreground outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all resize-y"
                        spellCheck={false}
                      />
                    </div>
                  )}

                  {/* Collapsible Parameter Inspector (ToolCallDisplay pattern) */}
                  <div className="mt-4 border border-white/5 rounded-2xl overflow-hidden bg-black/20">
                    <button
                      type="button"
                      onClick={() => toggleExpand(a.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-mono font-medium">
                        {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        Inspect Action Payload ({Object.keys(payload).length} parameters)
                      </span>
                      <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">JSON Data</span>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1 border-t border-white/5">
                        <pre className="p-3 rounded-xl bg-black/50 border border-white/5 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed">
                          {formatPayload(payload)}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-6 flex flex-wrap items-center gap-2.5">
                    <Button
                      onClick={() => decide(a.id, "approved")}
                      className="bg-white text-black hover:bg-white/90 font-medium px-5 rounded-full flex items-center gap-1.5"
                    >
                      <Check className="size-4 stroke-[2.5]" />
                      Approve & Execute
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => decide(a.id, "rejected")}
                      className="rounded-full border-white/10 hover:bg-white/5 text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                    >
                      <X className="size-4" />
                      Reject
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => toggleExpand(a.id)}
                      className="rounded-full text-muted-foreground hover:text-foreground text-xs"
                    >
                      {isExpanded ? "Hide Details" : "Review Payload"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {items.some((a) => a.status !== "pending") && (
          <div className="flex flex-col gap-3 mt-4">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase px-1">Decided Actions</h2>
            <div className="flex flex-col gap-2">
              {items
                .filter((a) => a.status !== "pending")
                .map((a) => (
                  <div
                    key={a.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="font-mono text-xs text-foreground/80 truncate">{a.action || "Action request"}</span>
                      <span className="text-xs text-muted-foreground truncate">— {a.reasoning_summary || a.action_payload?.subject || "Completed"}</span>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs capitalize font-medium"
                      style={{
                        color: a.status === "approved" ? "var(--state-working)" : "var(--state-failed)",
                        background: a.status === "approved" ? "color-mix(in oklab, var(--state-working) 15%, transparent)" : "color-mix(in oklab, var(--state-failed) 15%, transparent)",
                      }}
                    >
                      {a.status}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function MissionControlApprovals() {
  return (
    <MissionControlErrorBoundary>
      <ApprovalsContent />
    </MissionControlErrorBoundary>
  );
}
