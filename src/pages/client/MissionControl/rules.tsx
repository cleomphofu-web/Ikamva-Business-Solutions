import { useState } from "react";
import { PageHeader, Panel } from "@/components/ikamva/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLiveWorkspace, employeeName } from "@/lib/ikamva/live-workspace";
import { employeeApi } from "@/lib/ikamva/api-client";
import { toast } from "sonner";

function RulesPage() {
  const { employee, loading, error } = useLiveWorkspace();
  const [draft, setDraft] = useState(""); const [editing, setEditing] = useState<number | null>(null); const [saving, setSaving] = useState(false);
  const rules = Array.isArray(employee?.rules) ? employee.rules : [];
  async function save(nextRules: string[]) { if (!employee?.id) return; setSaving(true); try { await employeeApi.update(employee.id, { rules: nextRules }); setDraft(""); setEditing(null); toast("Rule saved."); } catch { toast.error("Unable to save rule."); } finally { setSaving(false); } }
  return <div className="flex flex-col gap-8"><PageHeader eyebrow="Rules" title={`How ${employeeName(employee)} works`} description="Add clear boundaries your Employee follows on every task." />
    <Panel title="Rules" description="List, edit, or remove your Employee's instructions.">
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading saved rules…</p>}
      {!loading && rules.length === 0 && <p className="text-sm text-muted-foreground">No rules saved yet.</p>}
      <ul className="flex flex-col gap-3">{rules.map((rule: string, index: number) => <li key={`${index}-${rule}`} className="flex flex-col gap-3 rounded-2xl border border-border/70 p-4"><div className="flex items-start justify-between gap-3">{editing === index ? <Textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} className="resize-none bg-transparent" /> : <p className="text-sm leading-relaxed">{rule}</p>}<div className="flex shrink-0 gap-2">{editing === index ? <Button size="sm" disabled={saving || !draft.trim()} onClick={() => void save(rules.map((value: string, i: number) => i === index ? draft.trim() : value))}>Save</Button> : <Button size="sm" variant="outline" onClick={() => { setEditing(index); setDraft(rule); }}>Edit</Button>}<Button size="sm" variant="ghost" disabled={saving} onClick={() => void save(rules.filter((_: string, i: number) => i !== index))}>Delete</Button></div></div></li>)}</ul>
      <div className="mt-6 flex flex-col gap-3"><Textarea value={editing === null ? draft : ""} onChange={e => setDraft(e.target.value)} rows={3} placeholder="e.g. Always confirm the order number before promising a refund date." className="resize-none rounded-2xl bg-transparent" /><div className="flex justify-end"><Button disabled={saving || !employee?.id || !draft.trim() || editing !== null} onClick={() => void save([...rules, draft.trim()])}>Add rule</Button></div></div>
    </Panel>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
export default RulesPage;
