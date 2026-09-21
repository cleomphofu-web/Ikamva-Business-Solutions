import { useEffect, useState } from 'react';
import { workforceApi } from '@/lib/ikamva/api-client';
function formatStepLabel(name?: string, taskType?: string) {
  const map: Record<string, string> = {
    email_read: 'Reading email',
    crm_lookup: 'Appending CRM context',
    lookup_customer: 'Appending CRM context',
    quote_generate: 'Generating quote',
    generate_quote: 'Generating quote',
    support_response: 'Drafting support response',
    draft_support_response: 'Drafting support response',
    lead_capture: 'Capturing lead',
    capture_lead: 'Capturing lead',
    crm_update: 'Updating CRM records',
    update_crm: 'Updating CRM records',
    email_draft: 'Creating Gmail draft',
    draft_email: 'Creating Gmail draft',
    approval_gate: 'Waiting for approval',
    await_approval: 'Waiting for approval',
    email_send: 'Sending email',
    send_email: 'Sending email',
  };
  const key = name || taskType || '';
  return map[key] || (key ? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Processing...');
}

export function AgentActivityTicker() {
  const [chains, setChains] = useState<Chain[]>([]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await workforceApi.listChains();
        if (!active) return;
        setChains((result.chains || []).slice(0, 5).map((chain: any) => ({
          id: chain.parentTask?.id,
          current_step_label: formatStepLabel(chain.currentStep?.step_name, chain.currentStep?.task_type),
          current_step_index: chain.currentStep?.step_index ?? 0,
          total_steps: chain.parentTask?.chain_config?.steps?.length || chain.steps?.length || 1,
          status: chain.overallStatus || 'running',
        })));
      } catch {
        if (active) setChains([]);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  if (!chains.length) return null;

  return <section aria-live="polite" className="rounded-2xl border border-border bg-card/60 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><span className="size-2 animate-pulse rounded-full bg-emerald-500" />Live AI activity</div><div className="mt-3 flex flex-col gap-3">{chains.map((chain) => { const total = Math.max(chain.total_steps, 1); const step = Math.min(chain.current_step_index + 1, total); return <div key={chain.id}><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{chain.current_step_label}</span><span className="text-muted-foreground">Step {step} of {total}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.round((step / total) * 100)}%` }} /></div><div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{chain.status}</div></div>; })}</div></section>;
}
