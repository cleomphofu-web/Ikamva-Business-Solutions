import { PageHeader, Panel, PreviewDataNote } from "@/components/ikamva/primitives";
import { Button } from "@/components/ui/button";
import { useLiveWorkspace, employeeName } from "@/lib/ikamva/live-workspace";
import { employeeApi } from "@/lib/ikamva/api-client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";



const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 6); // 06:00 – 18:00

function SchedulePage() {
  const { employee, loading, error } = useLiveWorkspace();
  const [editing, setEditing] = useState(false);
  const schedule = employee?.schedule || {};
  const [draft, setDraft] = useState<any>(schedule);
  useEffect(() => { if (!editing) setDraft(schedule); }, [employee?.id, employee?.schedule, editing]);
  const days = Array.isArray((editing ? draft : schedule).days) ? (editing ? draft : schedule).days : [];
  const start = (editing ? draft : schedule).start || "09:00";
  const end = (editing ? draft : schedule).end || "17:00";
  const startH = Number(start.slice(0, 2));
  const endH = Number(end.slice(0, 2));

  return (
    <>
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Schedule"
          title={`When ${employeeName(employee)} works`}
          description="Your employee only works inside these hours. Outside them she stays idle — nothing runs quietly in the background."
          actions={
            <Button onClick={() => { if (!editing) return setEditing(true); if (employee?.id) void employeeApi.update(employee.id, { schedule: draft }).then(() => { toast("Schedule saved."); setEditing(false); }).catch(() => toast.error("Unable to save schedule.")); }}>
              {editing ? "Save schedule" : "Edit schedule"}
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Working hours", value: `${start} — ${end}` },
            { label: "Timezone", value: schedule.timezone || "Not configured" },
            { label: "Next scheduled run", value: schedule.nextRun || "Not scheduled" },
          ].map((s) => (
            <div key={s.label} className="glass rounded-3xl p-6">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="font-display mt-2 text-lg font-semibold">{s.value}</p>
            </div>
          ))}
        </div>

        <Panel title="Working week" description="Green blocks are the hours your Employee is available.">
          <div className="-mx-2 overflow-x-auto px-2">
            <div className="min-w-[34rem]">
              <div className="mb-2 grid grid-cols-[5.5rem_repeat(13,minmax(0,1fr))] gap-1 text-[10px] text-muted-foreground">
                <span />
                {HOURS.map((h) => (
                  <span key={h} className="text-center tabular-nums">
                    {h}
                  </span>
                ))}
              </div>
              {ALL_DAYS.map((d) => {
                const on = days.includes(d);
                return (
                  <div
                    key={d}
                    className="grid grid-cols-[5.5rem_repeat(13,minmax(0,1fr))] items-center gap-1 py-1"
                  >
                    <span
                      className={cn(
                        "truncate text-sm",
                        on ? "text-foreground" : "text-muted-foreground/60",
                      )}
                    >
                      {d}
                    </span>
                    {HOURS.map((h) => {
                      const active = on && h >= startH && h < endH;
                      return (
                        <button type="button" disabled={!editing} onClick={() => setDraft((current: any) => ({ ...current, days: days.includes(d) ? days.filter((day: string) => day !== d) : [...days, d] }))}
                          key={h}
                          className={cn(
                            "h-6 rounded-md transition-colors",
                            active ? "bg-[color:var(--state-working)]/35" : "bg-muted/40",
                          )}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        {editing && <Panel title="Schedule details" description="Choose the hours and timezone for your Employee."><div className="grid gap-4 sm:grid-cols-3"><label className="text-sm">Start<input type="time" value={draft.start || "09:00"} onChange={e => setDraft({ ...draft, start: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-transparent p-2" /></label><label className="text-sm">End<input type="time" value={draft.end || "17:00"} onChange={e => setDraft({ ...draft, end: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-transparent p-2" /></label><label className="text-sm">Timezone<input value={draft.timezone || ""} onChange={e => setDraft({ ...draft, timezone: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-transparent p-2" /></label></div></Panel>}

        {loading && <p className="text-sm text-muted-foreground">Loading saved schedule…</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </>
  );
}

export default SchedulePage;
