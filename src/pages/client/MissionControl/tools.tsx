import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ikamva/primitives";
import { Button } from "@/components/ui/button";
import { employeeApi, workforceApi } from "@/lib/ikamva/api-client";
import { toast } from "sonner";



const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  connected: { label: "Connected", tone: "var(--state-working)" },
  available: { label: "Available", tone: "var(--state-idle)" },
  "needs-permission": { label: "Needs permission", tone: "var(--state-approval)" },
  disconnected: { label: "Disconnected", tone: "var(--state-failed)" },
};

function ToolsPage() {
  const [employee, setEmployee] = useState<any>({ name: "your Employee" });
  const [tools, setTools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const load = () => Promise.all([employeeApi.getMine(), workforceApi.listIntegrations()]).then(([e, i]) => { setEmployee(e.employee || { name: "your Employee" }); const integrations = i.integrations || []; setTools(integrations.some((item: any) => item.provider === "gmail") ? integrations : [...integrations, { id: "gmail-available", provider: "gmail", display_name: "Gmail", status: "disconnected", scopes: ["gmail.readonly", "gmail.send", "gmail.compose"], description: "Connect Gmail through a secured OAuth authorization." }]); }).catch((e) => setError(e.message || "Unable to load tool connections.")).finally(() => setLoading(false));
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "gmail") {
      toast.success("Gmail connected successfully.");
      void load();
    }
    if (params.get("gmail_error")) toast.error("Gmail connection was cancelled. You can try again when ready.");
  }, []);
  useEffect(() => { void load(); }, []);
  async function connect(name: string, provider: string, connected: boolean) {
    if (provider !== "gmail") { toast(`${name} is coming soon.`); return; }
    if (connected) { await workforceApi.disconnectGmail(); toast("Gmail disconnected."); void load(); return; }
    try {
      setConnecting(true);
    const result = await workforceApi.connectGmail('/dashboard/tools');
      const consentUrl = result.url || result.consent_url;
      if (!consentUrl) throw new Error("Gmail authorization URL was not returned.");
      window.location.href = consentUrl;
    } catch (e: any) { toast.error(e.message || "Unable to start Gmail connection."); setConnecting(false); }
  }
  return (
    <>
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="More Tools"
          title={`Systems ${employee.name} can reach`}
          description="Connecting a tool is how your employee moves from advice to action. You choose exactly what they may touch."
        />

        {loading ? <p className="text-sm text-muted-foreground">Loading live tool connections…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((t) => {
            const name = t.display_name || t.name || t.provider || "Connected tool";
            const scopes = Array.isArray(t.scopes) ? t.scopes : [];
            const s = STATUS_LABEL[t.status] || { label: t.status || "Unknown", tone: "var(--muted-foreground)" };
            return (
              <div key={t.id} className="glass flex flex-col rounded-3xl p-6">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-muted/60 text-sm font-semibold">
                    {name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{name}</h2>
                    <p className="text-xs" style={{ color: s.tone }}>
                      {s.label}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t.description || "No additional details available."}</p>
                <p className="mt-3 text-xs text-muted-foreground">{scopes.join(" · ") || "No scopes granted"}</p>
                <Button
                  variant={t.status === "connected" ? "outline" : "default"}
                  className="mt-6 self-start"
                  disabled={connecting}
                  onClick={() => void connect(name, t.provider, t.status === "connected")}
                >
                  {t.status === "connected" ? (t.provider === "gmail" ? "Disconnect" : "Manage") : t.provider === "gmail" ? "Connect Gmail" : "Coming soon"}
                </Button>
              </div>
            );
          })}
        </div>}
      </div>
    </>
  );
}

export default ToolsPage;
