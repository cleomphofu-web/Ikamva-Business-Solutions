import { CapacityMeter, PageHeader, Panel, PreviewDataNote } from "@/components/ikamva/primitives";
import { useLiveWorkspace, employeeName } from "@/lib/ikamva/live-workspace";



function HoursPage() {
  const { employee, logs, loading, error } = useLiveWorkspace();
  const capacity = { hoursUsed: logs.reduce((sum, log) => sum + Number(log?.hours_used || 0), 0), hoursTotal: Number(employee?.monthly_hours_limit || 0) };
  const hoursByDay = [] as { day: string; hours: number }[];
  const remaining = capacity.hoursTotal - capacity.hoursUsed;
  const max = Math.max(1, ...hoursByDay.map((d) => d.hours));
  const projected = (capacity.hoursUsed / 15) * 30;

  return (
    <>
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Monthly Hours"
          title="Capacity, in plain numbers"
          description={`${employeeName(employee)} has ${remaining.toFixed(1)} working hours left this month.`}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Hours used", value: capacity.hoursUsed.toFixed(1) },
            { label: "Hours remaining", value: remaining.toFixed(1) },
            { label: "Projected this month", value: projected.toFixed(0) },
          ].map((s) => (
            <div key={s.label} className="glass rounded-3xl p-6">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="font-display mt-2 text-3xl font-semibold">{s.value}</p>
            </div>
          ))}
        </div>

        <Panel title="This month">
          <CapacityMeter
            label="Monthly hours"
            used={capacity.hoursUsed}
            total={capacity.hoursTotal}
            tone="var(--chart-2)"
          />
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            At the current pace, {employeeName(employee)} will use around {projected.toFixed(0)} hours by month end —
            {projected > capacity.hoursTotal ? " above " : " within "} your {capacity.hoursTotal}-hour plan.
          </p>
        </Panel>

        <Panel title="Daily activity" description="Hours worked per day this week.">
          <div className="flex h-48 items-end gap-3">
            {hoursByDay.map((d) => (
              <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">{d.hours}</span>
                <div
                  className="w-full rounded-t-xl bg-[color:var(--chart-2)]/60 transition-[height] duration-700"
                  style={{ height: `${(d.hours / max) * 100}%` }}
                />
                <span className="text-xs text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
        </Panel>

        {loading && <p className="text-sm text-muted-foreground">Loading live hour tracking…</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </>
  );
}

export default HoursPage;
