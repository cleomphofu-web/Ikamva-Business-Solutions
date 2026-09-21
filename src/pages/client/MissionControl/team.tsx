import { useEffect, useState } from "react";
import { PageHeader, Panel } from "@/components/ikamva/primitives";
import { Switch } from "@/components/ui/switch";
import { useLiveWorkspace, employeeName } from "@/lib/ikamva/live-workspace";
import { specialistApi } from "@/lib/ikamva/api-client";
import { toast } from "sonner";
import { Sparkles, Users, Bot, CheckCircle2, AlertCircle } from "lucide-react";

interface Specialist {
  id: string;
  specialist_type: string;
  display_name: string;
  enabled: boolean;
  config: {
    description?: string;
    status?: string;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export default function TeamPage() {
  const { employee, loading } = useLiveWorkspace();
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [fetching, setFetching] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void specialistApi
      .list()
      .then((res) => {
        if (active && res?.specialists) {
          setSpecialists(res.specialists);
        }
      })
      .catch((err) => {
        console.error("Failed to load specialists:", err);
        toast.error("Unable to load specialist team.");
      })
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [employee?.id]);

  async function toggleSpecialist(spec: Specialist, nextState: boolean) {
    if (spec.config?.status === "not_yet_available") {
      toast.info("This specialist is coming soon and cannot be enabled yet.");
      return;
    }

    setTogglingId(spec.id);
    const prevList = [...specialists];
    setSpecialists((current) =>
      current.map((s) => (s.id === spec.id ? { ...s, enabled: nextState } : s))
    );

    try {
      await specialistApi.update(spec.id, { enabled: nextState });
      toast.success(`${spec.display_name} ${nextState ? "enabled" : "disabled"}.`);
    } catch (err) {
      console.error("Failed to toggle specialist:", err);
      setSpecialists(prevList);
      toast.error(`Could not update ${spec.display_name}.`);
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Specialist Team"
        title={`Meet ${employeeName(employee)}'s Specialists`}
        description="Behind your primary AI Employee is a dedicated team of scoped specialists handling quotes, customer support, CRM synchronization, and lead qualification."
      />

      <div className="glass rounded-3xl p-6 border border-white/10 bg-gradient-to-r from-card/80 to-card/40">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Manager: {employeeName(employee)}</h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Your primary AI point of contact in dashboard chat. Speaks directly to you as your operations manager, coordinates backend specialists, and reports on overall team progress.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {fetching && (
          <div className="col-span-2 py-8 text-center text-sm text-muted-foreground">
            Loading specialist roster…
          </div>
        )}

        {!fetching &&
          specialists.map((spec) => {
            const isComingSoon = spec.config?.status === "not_yet_available";
            return (
              <div
                key={spec.id}
                className="glass flex flex-col justify-between rounded-3xl p-6 border border-white/10"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">{spec.display_name}</h3>
                        {isComingSoon && (
                          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
                            Coming soon
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {spec.config?.description || "Dedicated specialist capability."}
                      </p>
                    </div>

                    <Switch
                      checked={spec.enabled}
                      disabled={isComingSoon || togglingId === spec.id}
                      aria-label={`Toggle ${spec.display_name}`}
                      onCheckedChange={(checked) => toggleSpecialist(spec, checked)}
                    />
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="capitalize">Type: {spec.specialist_type.replace("_", " ")}</span>
                  <span className="flex items-center gap-1.5">
                    {spec.enabled ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Active</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Inactive</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
