import { CapacityMeter, PageHeader, Panel, PreviewDataNote } from "@/components/ikamva/primitives";
import { useLiveWorkspace, employeeName } from "@/lib/ikamva/live-workspace";



const fmt = (n: number) => `${(n / 1_000_000).toFixed(2)}M`;

function TokensPage() {
  const { employee, logs, loading, error } = useLiveWorkspace();
  const tokensUsed = logs.reduce((sum, log) => sum + Number(log?.token_usage?.total_tokens || log?.token_usage?.total || 0), 0);
  const capacity = { tokensUsed, tokensTotal: Number(employee?.token_limit || 0) };
  const tokensByDay = [] as { day: string; tokens: number }[];
  const tokensByActivity = [] as { activity: string; tokens: number }[];
  const remaining = capacity.tokensTotal - capacity.tokensUsed;
  const max = Math.max(1, ...tokensByDay.map((d) => d.tokens));
  const maxAct = Math.max(1, ...tokensByActivity.map((d) => d.tokens));

  return (
    <>
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Token Usage"
          title="What her thinking costs"
          description="A token is a small piece of text your employee reads or writes. This page shows how much thinking she has done this month, and where it went."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Tokens used", value: fmt(capacity.tokensUsed) },
            { label: "Tokens remaining", value: fmt(remaining) },
            { label: "Estimated cost", value: `R ${((capacity.tokensUsed / 1_000_000) * 92).toFixed(0)}` },
          ].map((s) => (
            <div key={s.label} className="glass rounded-3xl p-6">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="font-display mt-2 text-3xl font-semibold">{s.value}</p>
            </div>
          ))}
        </div>

        <Panel title="This month">
          <CapacityMeter
            label="AI token usage"
            used={capacity.tokensUsed}
            total={capacity.tokensTotal}
            tone="var(--chart-3)"
            format={fmt}
          />
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            {employeeName(employee)} has roughly {fmt(remaining)} of thinking left this month. When it runs out she
            pauses and asks you before continuing.
          </p>
        </Panel>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Usage over time">
            <div className="flex h-44 items-end gap-3">
              {tokensByDay.map((d) => (
                <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-xl bg-[color:var(--chart-3)]/60"
                    style={{ height: `${(d.tokens / max) * 100}%` }}
                  />
                  <span className="text-xs text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Usage by activity">
            <ul className="flex flex-col gap-4">
              {tokensByActivity.map((a) => (
                <li key={a.activity}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{a.activity}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{fmt(a.tokens)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[color:var(--chart-3)]"
                      style={{ width: `${(a.tokens / maxAct) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading live token usage…</p>}
        {!loading && !error && logs.length === 0 && <p className="text-sm text-muted-foreground">No token usage recorded yet.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </>
  );
}

export default TokensPage;
