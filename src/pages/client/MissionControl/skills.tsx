import { useEffect, useState } from "react";
import { PageHeader, Panel, PreviewDataNote } from "@/components/ikamva/primitives";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLiveWorkspace, employeeName } from "@/lib/ikamva/live-workspace";
import { employeeApi, workforceApi } from "@/lib/ikamva/api-client";
import { toast } from "sonner";
import { skills as availableSkills } from "@/lib/ikamva/workspace-adapter";



const JOB_TONE: Record<string, string> = {
  running: "var(--state-working)",
  scheduled: "var(--state-waiting)",
  completed: "var(--state-idle)",
  failed: "var(--state-failed)",
};

function SkillsPage() {
  const { employee, logs, loading, error } = useLiveWorkspace();
  const configuredSkills = Array.isArray(employee?.configuration?.skills) ? employee.configuration.skills : [];
  const [skillIds, setSkillIds] = useState<string[]>([]);
  useEffect(() => { setSkillIds(configuredSkills); }, [employee?.id, employee?.configuration?.skills]);
  const [upgradeSkill, setUpgradeSkill] = useState<any>(null);
  const [jobSkill, setJobSkill] = useState<any>(null);
  const [jobInstruction, setJobInstruction] = useState("");
  const [savingSkill, setSavingSkill] = useState<string | null>(null);
  const skills = availableSkills.map((skill) => ({ ...skill, enabled: skillIds.includes(skill.id) }));
  const jobs = logs.filter((log) => log?.task_type && log.task_type !== "chat").map((log) => ({ id: log.id, title: log.action || log.task_type, skill: log.task_type, when: log.created_at ? new Date(log.created_at).toLocaleString() : "", state: log.error ? "failed" : "completed" }));

  return (
    <>
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Skills & Jobs"
          title={`What ${employeeName(employee)} can do`}
          description="A skill is a type of work your Employee is trained for. Skills outside your plan can be requested from our team."
        />

        <div className="grid gap-4 md:grid-cols-2">
          {skills.map((s) => (
            <div key={s.id} className="glass flex flex-col rounded-3xl p-6">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{s.name}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
                </div>
                <Switch
                  checked={s.enabled}
                  aria-label={`Enable ${s.name}`}
                  onCheckedChange={(v) => {
                    if (s.permissions.length > 0) { if (v && !s.enabled) setUpgradeSkill(s); return; }
                    if (!employee?.id) return;
                    setSavingSkill(s.id);
                    const nextSkills = v ? [...new Set([...skillIds, s.id])] : skillIds.filter((id: string) => id !== s.id);
                    setSkillIds(nextSkills);
                    void employeeApi.update(employee.id, { configuration: { ...(employee.configuration || {}), skills: nextSkills } }).then(() => toast(`${s.name} saved.`)).catch(() => { setSkillIds(skillIds); toast.error(`Unable to update ${s.name}.`); }).finally(() => setSavingSkill(null));
                  }}
                  disabled={savingSkill === s.id}
                />
              </div>
              <ul className="mt-4 flex flex-wrap gap-2">
                {s.capabilities.map((c) => (
                  <li key={c} className="rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                    {c}
                  </li>
                ))}
              </ul>
              {s.permissions.length > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Requires: {s.permissions.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>

        <Panel
          title="Jobs"
          description="Everything running, waiting and finished."
          actions={
            <Button disabled={skills.filter(s => s.enabled).length === 0} onClick={() => setJobSkill(skills.find(s => s.enabled) || null)}>
              Start a job
            </Button>
          }
        >
          <ul className="flex flex-col gap-3">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{j.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {j.skill} · {j.when}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize"
                  style={{
                    color: JOB_TONE[j.state],
                    background: `color-mix(in oklab, ${JOB_TONE[j.state]} 12%, transparent)`,
                  }}
                >
                  {j.state}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        {loading && <p className="text-sm text-muted-foreground">Loading saved skills and jobs…</p>}
        {!loading && !error && skills.length === 0 && <p className="text-sm text-muted-foreground">No skills configured yet.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      {jobSkill && <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-6" role="dialog" aria-modal="true">
        <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl"><h2 className="text-xl font-semibold">Start {jobSkill.name}</h2><p className="mt-2 text-sm text-muted-foreground">Describe the work your Employee should do.</p><textarea value={jobInstruction} onChange={e => setJobInstruction(e.target.value)} placeholder="e.g. Review the latest customer inquiries" className="mt-4 min-h-24 w-full rounded-2xl border border-border bg-transparent p-3 text-sm" /><div className="mt-5 flex justify-end gap-3"><Button variant="outline" onClick={() => { setJobSkill(null); setJobInstruction(""); }}>Cancel</Button><Button disabled={!jobInstruction.trim()} onClick={() => void workforceApi.sendMessage(jobInstruction.trim(), { task_type: "job" }).then(() => { toast("Job queued for the Employee."); setJobSkill(null); setJobInstruction(""); }).catch(() => toast.error("Unable to start job."))}>Queue job</Button></div></div>
      </div>}
      {upgradeSkill && <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-6" role="dialog" aria-modal="true" aria-labelledby="skill-upgrade-title">
        <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl">
          <h2 id="skill-upgrade-title" className="text-xl font-semibold">Upgrade {upgradeSkill.name}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{upgradeSkill.description}</p>
          <dl className="mt-5 space-y-2 text-sm"><div className="flex justify-between"><dt>Plan</dt><dd className="font-medium">Growth</dd></div><div className="flex justify-between"><dt>Estimated price</dt><dd className="font-medium">{upgradeSkill.id === "calendar" ? "R299/mo" : upgradeSkill.id === "email" ? "R499/mo" : "From R499/mo"}</dd></div></dl>
          <p className="mt-5 text-sm text-muted-foreground">Our team will contact you within 24 hours to activate your upgrade.</p>
          <div className="mt-6 flex gap-3"><Button asChild><a href="mailto:your-business-email@ikamva.co.za">Contact us to upgrade</a></Button><Button variant="outline" onClick={() => setUpgradeSkill(null)}>Not now</Button></div>
        </div>
      </div>}
    </>
  );
}

export default SkillsPage;
